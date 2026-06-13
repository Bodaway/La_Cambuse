# Spécifications Techniques Détaillées — Application de Cuisine Familiale IA

**Projet :** La Cambuse — assistant culinaire familial assisté par IA
**Version :** 1.0
**Date :** 13 juin 2026
**Statut :** Proposition de conception
**Document source :** `specifications-fonctionnelles.md` (v1.1) et `revue-specifications.md`

---

## 0. Contraintes structurantes

Deux contraintes commandent toutes les décisions de ce document :

1. **Hébergement sur serveur local domestique** — l'application tourne sur un PC à la maison, accessible depuis les appareils du foyer via le réseau local (Wi-Fi domestique). Pas de cloud public, pas d'hébergement managé. Le « cloud » mentionné dans la spec fonctionnelle (synchronisation, stockage) est **réinterprété comme le serveur local** : c'est lui le point central qui synchronise les appareils.
2. **Matériel ancien et peu puissant** — le PC hôte est vieux (CPU faible, RAM limitée, disque mécanique probable). L'architecture doit être **frugale** : empreinte mémoire basse, peu de processus, pas de base de données lourde, pas de conteneurs superflus, pas de build coûteux côté serveur.

Point clé qui rend ces deux contraintes compatibles : **le travail intensif (génération de recettes, planification, transcription photo, extraction d'URL) est délégué à l'API Claude**, qui s'exécute sur l'infrastructure d'Anthropic. Le serveur local ne fait qu'**orchestrer** : il assemble les requêtes, applique des filtres déterministes (allergènes), stocke les données et sert l'interface. Ces tâches sont liées aux entrées/sorties réseau et disque, pas au CPU — un vieux PC les gère sans difficulté.

### 0.1 Conséquences directes sur la pile technique

| Besoin | Choix frugal retenu | Pourquoi (vieux PC) |
|---|---|---|
| Base de données | **SQLite** (fichier unique, WAL) | Aucun serveur DB à faire tourner ; quelques Mo de RAM ; suffisant pour un foyer |
| Backend | **Python 3.11 + FastAPI + Uvicorn** (1 worker) | Empreinte ~60–90 Mo ; SDK Anthropic mûr (vision, sorties structurées) ; les appels IA sont réseau, pas CPU |
| Frontend | **PWA statique** (Svelte compilé) servie par le backend | Aucun rendu serveur ; HTML/JS/CSS statiques ; build fait sur le poste du dev, pas sur le vieux PC |
| Synchronisation multi-appareils | **SSE (Server-Sent Events) + polling de secours** | Une connexion HTTP longue par appareil (2–4 appareils) ; pas de broker de messages |
| Mode hors ligne | **Service Worker + IndexedDB** côté client | Le vieux PC ne participe pas ; tout se passe dans le navigateur de l'iPad |
| Déploiement | **Service systemd natif** (pas de Docker obligatoire) | Évite la surcouche conteneur sur matériel contraint |
| IA | **API Claude** (Anthropic), clé stockée côté serveur | Décharge tout le calcul lourd hors du PC hôte |

---

## 1. Vue d'ensemble de l'architecture

```
   Appareils du foyer (réseau local Wi-Fi)
 ┌───────────┐   ┌───────────┐   ┌───────────┐
 │   iPad    │   │  iPhone   │   │ Ordinateur│
 │ (cuisine) │   │ (courses) │   │(planning) │
 └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
       │ PWA           │ PWA           │ PWA
       │ (Service Worker + IndexedDB cache offline)
       └───────────────┼───────────────┘
                       │ HTTP/HTTPS sur le LAN
                       │ (lecture/écriture + flux SSE)
                       ▼
        ┌─────────────────────────────────┐
        │      VIEUX PC — SERVEUR LOCAL    │
        │                                  │
        │  ┌───────────────────────────┐   │
        │  │   FastAPI (Uvicorn, 1 w.) │   │
        │  │  ┌─────────────────────┐  │   │
        │  │  │ Routes REST + SSE   │  │   │
        │  │  ├─────────────────────┤  │   │
        │  │  │ Service IA (proxy)  │──┼───┼──► API Claude (Anthropic, cloud)
        │  │  ├─────────────────────┤  │   │      génération / transcription /
        │  │  │ FILTRE ALLERGÈNES   │  │   │      planification / extraction
        │  │  │ (déterministe, code)│  │   │
        │  │  ├─────────────────────┤  │   │
        │  │  │ Consolidation       │  │   │
        │  │  │ courses (détermin.) │  │   │
        │  │  └─────────────────────┘  │   │
        │  └────────────┬──────────────┘   │
        │               │                  │
        │        ┌──────▼───────┐          │
        │        │  SQLite (WAL)│          │
        │        │  + FTS5      │          │
        │        │  cambuse.db  │          │
        │        └──────────────┘          │
        │        Photos: dossier disque    │
        └─────────────────────────────────┘
```

**Principe directeur** : un seul processus serveur (FastAPI), une seule base (fichier SQLite), un dossier pour les images. Tout le reste est statique ou délégué.

---

## 2. Pile technique détaillée et justifications

### 2.1 Backend — Python 3.11 + FastAPI

- **FastAPI + Uvicorn** en **un seul worker** (`--workers 1`). Un foyer = quelques requêtes simultanées au maximum ; pas besoin de pool de processus. Un worker garde l'empreinte mémoire minimale et simplifie l'accès SQLite (pas de contention multi-process).
- **SDK officiel `anthropic`** (Python) pour les appels IA : vision (transcription photo), sorties structurées (extraction de recette en JSON validé), streaming (réponses du mode cuisine), prompt caching (mise en cache du profil famille).
- **Pydantic** pour la validation des entrées/sorties (déjà intégré à FastAPI).
- **httpx** (dépendance d'Uvicorn/Anthropic) pour récupérer le HTML des URL de recettes côté serveur.
- Dépendances minimales, pas d'ORM lourd : accès SQLite via le module standard `sqlite3` ou un micro-helper. Évite SQLAlchemy pour rester léger (gain mémoire et démarrage).

> Alternative envisagée : **Go** (binaire unique, ~15–20 Mo RAM). Plus frugal encore et plus simple à déployer (un fichier). Écarté comme choix par défaut car le SDK Anthropic Python est le plus complet pour la vision et les sorties structurées, et le projet est porté par un développeur solo. Go reste l'option de repli si la RAM devient critique — la conception (SQLite, REST, SSE, PWA statique) est transposable telle quelle.

### 2.2 Base de données — SQLite

- **Un fichier** `cambuse.db`, mode **WAL** (`PRAGMA journal_mode=WAL`) pour permettre lectures concurrentes pendant une écriture (utile avec le flux SSE + écritures).
- **FTS5** (extension de recherche plein texte intégrée à SQLite) pour la recherche de recettes par nom/ingrédient/tag (§5.4 fonctionnel) — aucun moteur de recherche externe.
- Volume attendu : quelques centaines de recettes, quelques milliers d'entrées d'historique. SQLite tient cela sans effort, même sur disque mécanique.
- **Sauvegarde** : copie périodique du fichier `.db` (script cron/`systemd timer`, voir §12.3). Option avancée : `litestream` pour réplication continue vers un disque externe (léger, facultatif).

### 2.3 Frontend — PWA statique (Svelte)

- **Svelte** compilé en fichiers statiques (HTML/CSS/JS). Svelte « disparaît » à la compilation : pas de runtime lourd embarqué → bundle petit, idéal pour l'iPad et pour un serveur qui ne fait que servir des fichiers.
- **Build effectué sur le poste du développeur**, pas sur le vieux PC. Le serveur ne reçoit que le dossier `dist/` final et le sert en statique via FastAPI (`StaticFiles`).
- **PWA** : `manifest.json` + **Service Worker** pour :
  - mise en cache de l'app shell (chargement instantané, fonctionnement hors ligne) ;
  - cache des données nécessaires au mode cuisine et à la liste de courses (IndexedDB) ;
  - **notifications locales** des minuteries (API Notifications + Service Worker), fonctionnant écran verrouillé / app en arrière-plan, sans serveur (§8.4 fonctionnel).
- **Responsive** : une seule base de code, trois agencements (iPad cuisine / ordinateur planning / mobile courses) via CSS et points de rupture (§12.2 fonctionnel).

### 2.4 Pourquoi pas de Docker obligatoire

Docker ajoute une couche (daemon, overlay filesystem) qui consomme RAM et I/O sur un matériel déjà contraint. Déploiement recommandé : **environnement virtuel Python + service systemd**. Docker reste possible (image légère type `python:3.11-slim`) si le foyer préfère l'isolation, mais ce n'est pas le défaut.

---

## 3. Intégration IA (API Claude)

### 3.1 Architecture du service IA

Toutes les fonctionnalités IA passent par un **module proxy côté serveur**. Les appareils clients ne parlent **jamais** directement à l'API Claude :

- la **clé API reste sur le serveur** (variable d'environnement, jamais exposée au client) ;
- le serveur **construit le prompt** (profil famille + contexte de la demande), appelle Claude, **applique le filtre allergènes déterministe au résultat**, puis renvoie au client ;
- centralise la gestion d'erreurs, des quotas et du cache de prompt.

### 3.2 Choix du modèle

L'application étant centrée IA mais à **usage personnel et sensible au coût** (la spec fonctionnelle §4.2 et §15.2 le souligne), on retient une **stratégie par paliers** plutôt qu'un modèle unique. Tous les modèles cités supportent la vision et les sorties structurées nécessaires.

| Tâche | Modèle recommandé | ID exact | Justification |
|---|---|---|---|
| Planification, génération de recettes, transcription photo, conversation cuisine | **Claude Sonnet 4.6** | `claude-sonnet-4-6` | Meilleur équilibre intelligence/coût (3 $/15 $ par M tokens) ; vision ; sorties structurées ; pensée adaptative ; contexte 1M |
| Extraction depuis URL, questions simples, Q/R courtes | **Claude Haiku 4.5** | `claude-haiku-4-5` | Le moins cher (1 $/5 $) et le plus rapide ; suffisant pour structurer un HTML déjà récupéré |
| Option « qualité maximale » de planification | **Claude Opus 4.8** | `claude-opus-4-8` | Substituable au cas par cas si la qualité de planification le justifie (5 $/25 $) |

> **Compromis assumé** : on privilégie Sonnet 4.6 comme cheval de bataille pour le coût, conformément aux préoccupations budgétaires de la spec fonctionnelle. Le modèle est **configurable** (variable d'environnement par type de tâche) : passer en Opus 4.8 (voire Fable 5, `claude-fable-5`, le modèle le plus capable) pour la planification est un simple changement de configuration, sans modification du code.

### 3.3 Paramètres d'appel

- **Pensée adaptative** (`thinking: {type: "adaptive"}`) pour la planification et la génération (raisonnement de qualité sans budget de tokens à régler).
- **Effort** (`output_config: {effort: ...}`) : `medium` par défaut pour équilibrer coût/qualité ; `low` pour les tâches simples (extraction, Q/R cuisine).
- **Streaming** pour les réponses longues (génération de recette, planning) afin de ne pas heurter les délais et d'afficher la progression (latence cible §15.1).
- **Sorties structurées** (`output_config.format` avec un schéma JSON) pour l'import URL, la transcription photo et la génération : Claude renvoie directement un objet recette validé (titre, ingrédients [nom, quantité, unité], étapes, temps, portions), évitant le parsing fragile.

### 3.4 Cache de prompt (réduction de coût)

Le **profil famille** (§4 fonctionnel) et, le cas échéant, un extrait de la bibliothèque sont envoyés à chaque interaction IA. On applique le **prompt caching** (`cache_control: {type: "ephemeral"}`) sur le bloc de profil :

- le profil change rarement → il forme un préfixe stable mis en cache ;
- les lectures de cache coûtent ~0,1× le prix d'entrée → économie substantielle sur les planifications/conversations répétées d'une même session.
- Règle : garder le contenu stable (profil) **avant** le contenu volatile (demande du moment), sans interpoler de date/horodatage dans le préfixe (sinon le cache est invalidé).

### 3.5 Construction du contexte par module

À chaque appel, le service IA assemble (selon §14.3 fonctionnel) :

- le **texte exact du profil famille** (mis en cache) ;
- le **contexte de la demande** (module actif, recette en cours, planning courant) ;
- les **données pertinentes** : historique récent pour la planification ; étapes de la recette pour le mode cuisine.
- Un **endpoint de transparence** expose au client le résumé de ce qui est envoyé à l'IA (exigence « pas de boîte noire », §10.1).

### 3.6 Gestion des erreurs et quotas IA (§15.2 / §15.3 fonctionnel)

- Erreur API / quota atteint / réseau coupé → message clair (« Service IA momentanément indisponible »), code HTTP propre renvoyé au client, et **les fonctionnalités hors-IA restent utilisables** (navigation, cochage, minuteries).
- Le SDK Anthropic gère les retentatives (429/5xx) avec backoff exponentiel ; on conserve ce comportement et on journalise le `request_id` en cas d'échec.

---

## 4. Garde-fou allergènes — module déterministe (CRITIQUE)

C'est le point le plus important de la revue (§1.1) et le seul composant qui **ne doit jamais dépendre de l'IA**.

### 4.1 Principe

Un **filtre codé en dur** (Python, aucune IA) vérifie tout ingrédient — qu'il provienne d'une recette importée, générée, ou d'une substitution proposée — contre la liste d'allergènes déclarés dans le profil. Il s'applique **après** chaque réponse de l'IA et **avant** présentation à l'utilisateur.

### 4.2 Implémentation

- **Dictionnaire de synonymes/dérivés par allergène** (table SQLite `allergen_terms`, éditable) : ex. `arachide → {cacahuète, cacahuete, huile d'arachide, peanut, beurre de cacahuète}` ; `gluten → {blé, ble, froment, seigle, orge, épeautre, malt, farine de blé}` ; `lait → {lait, crème, beurre, fromage, lactose, ...}`. Couvre les 14 allergènes réglementaires UE.
- **Normalisation** du texte ingrédient avant comparaison : minuscules, suppression des accents, singulier/pluriel, espaces. Réutilise le même normaliseur que la consolidation des courses (§5.3).
- **Correspondance par sous-chaîne sur termes normalisés**, conçue pour **sur-signaler plutôt que rater** : en cas de doute, on bloque/signale. Un faux positif est sans danger ; un faux négatif peut l'être.
- Pour les **allergies graves/anaphylactiques**, un **avertissement persistant** est attaché à la réponse (« Vérifiez toujours les étiquettes — l'application ne peut garantir l'absence de traces »), affiché par le client (§10.4 fonctionnel).

### 4.3 Points d'application (correspond aux critères d'acceptation §18.5)

| Scénario | Comportement du filtre |
|---|---|
| Recette générée par l'IA (§5.2.3) | Tout ingrédient allergène → bloqué/signalé ; l'utilisateur en est informé |
| Recette importée (URL/photo) | Signalement à la validation avant sauvegarde |
| Substitution en mode cuisine (§8.6) | **Aucune** substitution contenant un allergène déclaré n'est renvoyée, même sur demande explicite ; message explicatif |

### 4.4 Architecture logicielle

Le filtre est une fonction pure `filtrer_allergenes(ingredients, profil_allergenes) -> {bloqués, avertissements}` appelée systématiquement par le service IA. Il est **testé unitairement** en priorité (voir §13), car c'est le composant de sécurité alimentaire.

---

## 5. Modèle de données (schéma SQLite)

Tables principales (types simplifiés ; clés étrangères activées via `PRAGMA foreign_keys=ON`). Tous les enregistrements portent `created_at` / `updated_at` (epoch ms) pour la résolution de conflits (§9).

```sql
-- Compte familial unique (v1.0)
compte(id, email, mot_de_passe_hash, created_at, updated_at)

-- Profil famille : texte libre + liste allergènes séparée (déterministe)
profil(id, compte_id, texte, zone_geo, updated_at)
profil_allergene(id, profil_id, allergene, gravite)   -- gravite: legere|moderee|grave|anaphylactique
allergen_terms(id, allergene, terme_normalise)        -- dictionnaire du filtre §4

-- Stock de base (produits toujours disponibles, exclus des courses)
stock_base(id, compte_id, nom, nom_normalise)

-- Bibliothèque de recettes
recette(id, compte_id, titre, description, categorie, portions,
        temps_prep, temps_cuisson, difficulte, notes, source,
        photo_chemin, note_famille, archivee, recette_source_id, -- variante de
        created_at, updated_at)
recette_tag(id, recette_id, tag)
ingredient(id, recette_id, nom, nom_normalise, quantite, unite, etape_index)
etape(id, recette_id, numero, texte, duree_min)
recette_fts USING fts5(titre, ingredients, tags, content='recette') -- recherche

-- Planning
planning(id, compte_id, date_debut, date_fin, statut, created_at, updated_at)
repas(id, planning_id, jour, type_repas, recette_id, statut, raison_ia) -- statut: planifie|fait|vide

-- Courses
liste_courses(id, planning_id, compte_id, created_at, updated_at)
article_courses(id, liste_id, nom, nom_normalise, quantite, unite, rayon,
                coche, ajout_manuel, recettes_source) -- recettes_source: JSON [ids]

-- Historique (source de vérité unique, §9 fonctionnel)
historique(id, compte_id, recette_id, date_realisation, nb_personnes,
           note, commentaire, adaptations, source_planning)

-- Sessions d'authentification
session(id, compte_id, token_hash, appareil, expire_at, created_at)
```

Notes de conception :

- Le champ **« Historique » d'une recette** (§5.3 fonctionnel) est une **vue dérivée** de la table `historique` (`COUNT(*)`, `MAX(date_realisation)`) — pas de donnée dupliquée, conformément à la revue §2 (source de vérité unique).
- **Suppression douce** : `recette.archivee` (booléen). Une recette référencée dans un planning actif ou l'historique est archivée, jamais supprimée physiquement (§5.3 fonctionnel, revue §2.7).
- **Variantes** : `recette.recette_source_id` pointe vers la recette d'origine, conservée intacte (§8.7).
- `nom_normalise` est pré-calculé partout où la fusion/recherche en a besoin (ingrédients, articles, stock) → un seul algorithme de normalisation partagé avec le filtre allergènes.

---

## 6. API REST + flux temps réel

### 6.1 Conventions

- API JSON sous `/api/...`, authentifiée par cookie de session `httpOnly`.
- Réponses incluant `updated_at` pour permettre au client de détecter les changements.
- Latences cibles (§15.1) : navigation < 300 ms (servie directement depuis SQLite) ; les endpoints IA renvoient en streaming.

### 6.2 Principaux endpoints (par module)

| Module | Endpoints (extraits) |
|---|---|
| Auth (§13) | `POST /api/auth/inscription`, `POST /api/auth/connexion`, `POST /api/auth/deconnexion`, `POST /api/auth/reinit-mdp` |
| Profil (§4) | `GET/PUT /api/profil`, `GET/PUT /api/profil/allergenes`, `POST /api/profil/assistant` (rédaction guidée IA), `GET /api/profil/contexte-ia` (transparence §10.1) |
| Recettes (§5) | `GET /api/recettes` (recherche/filtre/tri via FTS5), `POST /api/recettes`, `PUT/DELETE /api/recettes/{id}` (archivage), `POST /api/recettes/import-url`, `POST /api/recettes/import-photo`, `POST /api/recettes/generer` |
| Planning (§6) | `POST /api/planning/generer` (mode express/guidé, streaming), `GET /api/planning/{id}`, `PUT /api/planning/{id}/repas/{rid}` (remplacer/vider/déplacer), `POST /api/planning/{id}/conversation` (ajustement IA), `POST /api/planning/{id}/valider` |
| Courses (§7) | `POST /api/courses/generer`, `GET /api/courses/{id}`, `PUT /api/courses/{id}/article/{aid}` (cocher/quantité), `POST /api/courses/{id}/article` (ajout manuel), `POST /api/courses/{id}/maj-ciblee` (fusion §7.6), `GET /api/courses/{id}/export` |
| Cuisine (§8) | `POST /api/cuisine/demander-ia` (streaming, requiert connexion), `POST /api/cuisine/{recette_id}/terminer` (→ historique + variante éventuelle) |
| Historique (§9) | `GET /api/historique`, `GET /api/historique/stats` |
| Sync | `GET /api/sync/flux` (SSE) |

### 6.3 Import URL — détail technique (§5.2.1, critères §18.1)

1. Le **serveur** récupère le HTML de l'URL via `httpx` (le client ne le fait pas → contourne CORS, garde la clé IA côté serveur).
2. Détection des cas hors périmètre (§5.2.1) : paywall / anti-scraping (réponse vide, 403, contenu trop court) → message explicatif + saisie manuelle proposée ; URL de vidéo (YouTube/TikTok/Insta) → refus explicite.
3. Le HTML nettoyé est envoyé à **Claude Haiku 4.5** avec un **schéma de sortie structurée** → objet recette JSON validé.
4. **Filtre allergènes** appliqué, prévisualisation renvoyée au client pour correction avant sauvegarde.

### 6.4 Transcription photo (§5.2.2)

- Upload de l'image (multipart) → stockée sur disque (dossier `photos/`, pas dans SQLite).
- Image envoyée à **Claude Sonnet 4.6** (vision) avec sortie structurée. Plusieurs photos d'une même recette combinées en une requête.
- Filtre allergènes + prévisualisation avant sauvegarde.

### 6.5 Synchronisation multi-appareils (revue §1.2, §1.3)

Le serveur local **est** le point de synchronisation (réinterprétation du « cloud »). Mécanisme :

- **SSE** (`GET /api/sync/flux`) : chaque appareil ouvre une connexion HTTP longue ; quand une donnée change (planning, liste, cochage), le serveur pousse un évènement léger `{type, entite, id, updated_at}` ; les appareils rafraîchissent l'entité concernée. Léger (2–4 connexions), pas de broker.
- **Polling de secours** : si SSE indisponible (proxy, navigateur), repli sur un `GET` périodique conditionné par `updated_at`.
- **Résolution de conflits** : « dernière modification gagne » sur `updated_at`, avec notification si un conflit entre appareils est détecté (§15.3 fonctionnel). Suffisant pour un foyer (écritures concurrentes rares).
- Cas d'usage cible : liste préparée sur l'ordinateur, **cochage en magasin synchronisé** vers les autres appareils (§11.5). La liste est donc **`Local + serveur`**, corrigeant l'incohérence relevée en revue §1.3.

---

## 7. Consolidation de la liste de courses — module déterministe (§7.2)

Comme le filtre allergènes, la consolidation est **codée**, pas confiée à l'IA (fiabilité, gratuité, reproductibilité). Critères d'acceptation §18.3.

1. **Agrégation** des ingrédients de toutes les recettes du planning validé, quantités ajustées aux portions configurées.
2. **Normalisation des noms** (singulier/pluriel, accents, orthographe) — algorithme partagé avec §4 et §5.
3. **Conversion d'unités métriques compatibles** (g↔kg, ml↔l, etc.) via une table de conversions fixe.
4. **Fusion** des lignes identiques après normalisation. **En cas d'ambiguïté** (ex. « 200 g de tomates cerise » + « 1 barquette de tomates cerise », unités non convertibles) → **deux lignes présentées séparément** avec invitation à fusionner manuellement (jamais de fusion hasardeuse).
5. **Retrait du stock de base** (§7.3) par correspondance sur `nom_normalise`.
6. **Classement par rayon** : table de correspondance ingrédient→rayon (Fruits & légumes, Viandes & poissons, etc.), avec rayon par défaut « Épicerie » si inconnu.
7. **Règle de fusion lors d'une mise à jour de planning** (§7.6, revue §2.3) : les **ajouts manuels** et les **articles cochés** sont préservés ; seuls les ingrédients issus des recettes modifiées sont recalculés (`maj-ciblee`).

Les **suggestions anti-gaspillage** (§7.4), elles, peuvent être générées par l'IA et affichées dans un panneau latéral séparé, non intrusif — elles n'altèrent jamais la liste déterministe.

---

## 8. Mode cuisine et fonctionnement hors ligne (§8, §12.3, critères §18.4)

C'est la partie où le **client** (PWA) prend le relais, indépendamment du serveur, pour résister aux coupures Wi-Fi en cuisine.

### 8.1 Stratégie hors ligne

- **Au lancement d'une session cuisine**, le client télécharge la recette complète (étapes, ingrédients, durées, photo) et la stocke en **IndexedDB**.
- **Service Worker** : met en cache l'app shell + la recette en cours → navigation pas-à-pas, vue d'ensemble des étapes, retour en arrière **fonctionnent intégralement hors connexion**.
- **Minuteries** : entièrement côté client (timers JS + **notifications locales** via Service Worker), **alerte sonore et visuelle même écran verrouillé / app en arrière-plan**, sans serveur. Plusieurs minuteries nommées simultanées (§8.4).
- **Marquage « réalisé » + saisie de note** hors ligne : mis en file dans IndexedDB, **synchronisés au retour du réseau**.
- **Bouton « Demander à l'IA »** : **requiert la connexion** ; grisé avec mention « connexion requise » si hors ligne (§8.5). C'est la seule fonction du mode cuisine indisponible hors ligne.

### 8.2 Détection de connectivité

Le client surveille l'accessibilité du serveur local (ping léger sur un endpoint `/api/sante`). État réseau exposé à l'UI pour griser dynamiquement les fonctions IA et indiquer le mode dégradé (§12.3).

### 8.3 Fin de session (§8.7)

`POST /api/cuisine/{recette_id}/terminer` : enregistre dans l'historique (date, note, commentaire, adaptations). Si des adaptations ont été faites, propose de créer une **variante** (nouvelle recette `recette_source_id` = recette d'origine, conservée intacte).

---

## 9. Authentification et sécurité (§13, §14)

### 9.1 Comptes

- **Compte familial unique** (v1.0). Création par e-mail + mot de passe.
- Mot de passe haché avec **Argon2** (ou bcrypt) — jamais en clair.
- **Sessions persistantes** sur appareils de confiance : cookie `httpOnly` + `SameSite=Lax`, token aléatoire stocké haché en base. Pas de reconnexion forcée à chaque ouverture (§13.2).
- **Connexions simultanées** multi-appareils : plusieurs sessions valides en parallèle (table `session`).
- **Réinitialisation de mot de passe** par e-mail : nécessite un relais SMTP. Sur réseau purement local sans e-mail sortant, repli documenté sur une réinitialisation locale (accès console serveur) — à trancher selon la configuration du foyer.

### 9.2 Chiffrement (§13.2, §14.1)

Le profil contient des **données de santé** (allergies) et concernant des enfants. Exigence : chiffré **en transit** et **au repos**.

- **En transit** : **TLS sur le LAN**. Comme il n'y a pas de domaine public, on génère un certificat local (`mkcert` crée une autorité de certification de confiance pour les appareils du foyer, évitant les avertissements navigateur ; ou certificat auto-signé importé sur les appareils). FastAPI derrière TLS, ou reverse-proxy léger (Caddy en local) si préféré.
- **Au repos** : deux options selon les moyens du foyer — (a) **chiffrement du disque/partition** de l'hôte (transparent, recommandé, aucun surcoût applicatif) ; (b) **SQLCipher** (SQLite chiffré) si le chiffrement disque est indisponible. Option (a) privilégiée sur vieux matériel pour ne pas alourdir chaque requête.
- Les **photos** sur disque sont couvertes par le chiffrement de partition (option a).

### 9.3 Confidentialité IA (§14.4)

- **Fournisseur retenu : Anthropic (Claude).** La spec exige la non-utilisation des données pour l'entraînement → **API entreprise d'Anthropic, qui n'entraîne pas sur les données soumises via l'API** (à confirmer contractuellement avant mise en production, comme l'exige §14.4).
- Endpoint de transparence (§3.5) : l'utilisateur peut consulter ce qui est envoyé à l'IA.
- **Suppression complète des données** (§14.2) : endpoint `DELETE /api/compte` qui purge la base et les photos, irréversible, avec confirmation explicite.

---

## 10. Exigences non fonctionnelles sur matériel ancien (§15)

| Exigence | Réponse technique | Adaptation « vieux PC » |
|---|---|---|
| Navigation < 300 ms (§15.1) | Lecture directe SQLite + index ; PWA pré-cache l'app shell | I/O disque seules ; aucun calcul lourd |
| Réponse IA cuisine < 5 s | Haiku/Sonnet en streaming | Calcul déporté chez Anthropic, pas sur le PC |
| Planning < 15 s avec indicateur | Streaming + barre de progression côté client | Idem — le PC ne calcule pas |
| Sauvegarde automatique (§15.3) | Écritures transactionnelles SQLite (WAL) ; aucune perte sur fermeture brutale | Léger |
| Disponibilité IA dégradée (§15.3) | Fonctions hors-IA pleinement opérationnelles | Le serveur local reste autonome |
| Empreinte mémoire | 1 worker Uvicorn + SQLite ≈ 80–120 Mo total | Tient sur un PC ancien avec marge |
| Démarrage | Service systemd au boot ; pas de build runtime | Démarrage en quelques secondes |

---

## 11. Découpage MVP — traduction technique (§17 fonctionnel)

### Phase 1 — MVP (fondation technique)
- Squelette FastAPI + SQLite (schéma §5) + service systemd + TLS local.
- Auth (compte familial, sessions multi-appareils).
- Profil famille (texte + table allergènes + dictionnaire) et **filtre allergènes déterministe** (§4) — prioritaire car composant de sécurité.
- Recettes : import URL (Haiku + sortie structurée) + saisie manuelle ; recherche FTS5.
- Planning : mode Express (Sonnet, streaming) + ajustements manuels.
- Courses : **consolidation déterministe** (§7) + organisation par rayon + cochage + **synchronisation SSE**.
- Mode cuisine : PWA navigation pas-à-pas + **minuteries (notifications locales)** + **fonctionnement hors ligne** (Service Worker + IndexedDB).

### Phase 2 — Enrichissement IA
- Mode cuisine : assistant IA temps réel + adaptation + variantes.
- Planning : mode Guidé + conversation contextuelle + explications.
- Recettes : import photo (vision) + génération IA.
- Historique enrichi : notes, stats, apprentissage des préférences (injection de l'historique dans le contexte IA).

### Phase 3 — Intelligence proactive
- Suggestions anti-gaspillage (panneau latéral, IA).
- Suggestions saisonnières + enrichissement automatique du profil.
- Statistiques avancées.
- Export/portabilité enrichis (§14.2).

---

## 12. Déploiement et exploitation

### 12.1 Installation sur le vieux PC
1. Python 3.11 + environnement virtuel ; `pip install` des dépendances (anthropic, fastapi, uvicorn, pydantic, httpx).
2. Copie du dossier `dist/` du frontend (build fait ailleurs).
3. Initialisation de `cambuse.db` (migrations SQL) + dossier `photos/`.
4. Variable d'environnement `ANTHROPIC_API_KEY` (et modèles configurables par tâche).
5. Certificat TLS local (`mkcert`).
6. Service **systemd** `cambuse.service` (redémarrage auto, lancement au boot).

### 12.2 Accès depuis les appareils
- Nom d'hôte local (ex. `https://cambuse.local` via mDNS/Bonjour) ou IP fixe du PC sur le LAN.
- PWA « installable » sur l'écran d'accueil de l'iPad/iPhone.

### 12.3 Sauvegarde et résilience
- **`systemd timer`** quotidien : copie de `cambuse.db` (utiliser l'API de sauvegarde SQLite ou copier en mode WAL checkpoint) + `photos/` vers un disque externe/NAS.
- Option `litestream` pour réplication continue si un second support est disponible.
- Rappel de la nature **éphémère du conteneur d'exécution distant** non applicable ici : les données vivent sur le disque du foyer ; la sauvegarde est la responsabilité de l'utilisateur.

---

## 13. Stratégie de tests

Priorité aux composants déterministes et de sécurité :

1. **Filtre allergènes (§4)** — couverture unitaire maximale : synonymes, accents, dérivés (huile d'arachide), substitutions, scénarios §18.5. Composant de sécurité alimentaire → non négociable.
2. **Consolidation des courses (§7)** — fusion, conversions d'unités, cas ambigus, préservation des ajouts manuels/cochages lors d'une mise à jour (§18.3).
3. **Normalisation des noms** — fonction partagée, testée isolément.
4. **Service IA** — tests avec réponses mockées (pas d'appel réel en CI) ; vérification que le filtre allergènes est bien appliqué en sortie.
5. **Import URL** — cas nominal + paywall/anti-scraping + erreur réseau (§18.1).
6. **Sync/offline** — file d'attente IndexedDB, reprise après reconnexion, résolution de conflits « dernière modification gagne ».

---

## 14. Synthèse des décisions clés

| Décision | Choix | Motivation principale |
|---|---|---|
| Hébergement | Serveur local domestique, accès LAN | Contrainte projet |
| Frugalité | SQLite + 1 worker FastAPI + PWA statique, pas de Docker obligatoire | Vieux PC peu puissant |
| Travail lourd | Délégué à l'API Claude | Décharge le CPU du PC hôte |
| Modèle IA | Sonnet 4.6 (défaut), Haiku 4.5 (tâches simples), Opus 4.8/Fable 5 (option) | Équilibre coût/qualité, configurable |
| Sécurité alimentaire | Filtre allergènes **déterministe**, jamais l'IA | Exigence critique (revue §1.1) |
| Courses | Consolidation **déterministe** | Fiabilité, gratuité |
| Synchronisation | Serveur local + SSE, « dernière modif gagne » | Corrige les incohérences de la spec (revue §1.2/1.3) |
| Hors ligne | Service Worker + IndexedDB + notifications locales | Mode cuisine résistant aux coupures (revue §1.5) |
| Confidentialité | Clé IA côté serveur ; TLS local ; chiffrement disque ; Anthropic sans entraînement | Données de santé / mineurs (§14.4) |
