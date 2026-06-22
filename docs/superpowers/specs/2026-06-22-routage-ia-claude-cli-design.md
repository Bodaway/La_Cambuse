# Design Technique — Routage des appels IA (couche AIProvider)

**Projet :** Application de cuisine familiale IA (« La Cambuse »)
**Date :** 22 juin 2026
**Statut :** Validé (design), prêt pour planification d'implémentation
**Portée :** Couche d'accès à l'IA du backend — comment l'application appelle Claude en développement (via le CLI Claude Code, sur abonnement) et comment elle basculera vers l'API Anthropic en production, sans réécriture.
**Documents liés :** `docs/specifications-fonctionnelles.md` (v1.1), `docs/revue-specifications.md`.

---

## 1. Contexte et objectif

La spécification fonctionnelle laisse le fournisseur IA « à définir » (§14.4) alors que toutes les fonctionnalités centrales en dépendent : génération de planning, génération/extraction de recettes, assistant cuisine, transcription photo.

Pendant le développement, l'objectif est de **router les appels IA de l'application vers le CLI Claude Code**, qui s'authentifie via l'abonnement de l'utilisateur — donc sans coût d'API et sans clé à gérer. À terme (app déployée), il faudra basculer vers l'**API Anthropic** (clé pay-as-you-go), pour des raisons de conformité (CGU : l'abonnement ne peut pas alimenter une app tierce déployée) et de performance.

Ce design garantit que **ce basculement ne touche aucun code métier** : il se résume à changer une variable d'environnement.

> ⚠️ **Limite assumée :** le routage via CLI est réservé au **développement local mono-utilisateur**. Il utilise l'abonnement personnel du développeur. Une application déployée ou multi-utilisateurs **doit** utiliser l'API Anthropic.

---

## 2. Décisions d'architecture de référence (contexte)

Décisions prises lors du brainstorming, dont ce design dépend ou qu'il complète. Chacune fera l'objet de sa propre spec d'implémentation le moment venu — elles sont ici pour le contexte, pas détaillées.

| Sujet | Décision | Justification |
|---|---|---|
| Plateforme | **Web app responsive (PWA), base de code unique** | Couvre iPad/desktop/mobile (§12.1) ; « Toi + Claude Code » → stack standard |
| Minuteries hors ligne | Alerte fiable surtout app ouverte/écran allumé ; dégradation acceptée en arrière-plan | §8.4 assoupli → pas de wrapper natif nécessaire |
| Backend & synchro | **Supabase** (Postgres + Auth + Realtime + Storage) + **cache IndexedDB / file d'attente d'écritures (outbox)** | Données relationnelles, filtre allergènes déterministe en SQL, offline modeste à faible concurrence |
| Résolution de conflits | « Dernière modification gagne » (§15.3) | Foyer unique, faible concurrence |
| Filtre allergènes | **Déterministe (non-IA)**, en SQL, hors de la couche IA | Sécurité critique : ne doit jamais dépendre du LLM (§4.2) |
| Moteur IA | **API Anthropic en production**, **CLI Claude Code en développement** | Voir le présent document |

---

## 3. Principe : couche d'abstraction « AIProvider »

Le backend n'appelle **jamais** directement le CLI ni l'API. Il appelle une **interface unique** exprimée en méthodes métier. L'implémentation concrète est choisie au démarrage via une variable d'environnement.

```
   App backend
       │  appelle des méthodes métier (jamais « Claude » directement)
       ▼
  AIProvider (interface)
   ├─ generatePlan(profil, contraintes)      → PlanningJSON
   ├─ extractRecipe(source)                  → RecetteJSON
   ├─ generateRecipe(description, profil)    → RecetteJSON
   ├─ cookingAssistant(question, contexte)   → string
   └─ transcribeRecipePhoto(image)           → RecetteJSON   (Phase 2 — voir §6)
       │
       ├─ ClaudeCliProvider    ← DÉVELOPPEMENT (abonnement, via le CLI)
       └─ AnthropicApiProvider ← PRODUCTION (clé API)
```

- **Sélection :** variable d'environnement `AI_PROVIDER` (`cli` | `api`).
- **Invariant :** tout le code métier dépend uniquement de l'interface `AIProvider`. Aucune fonctionnalité ne connaît le détail du transport.
- **Filtre allergènes :** appliqué **après** la réponse IA, par la couche déterministe (SQL), quelle que soit l'implémentation du provider. Le provider ne porte aucune responsabilité de sécurité allergènes.

### Contrat de l'interface

Chaque méthode :
- reçoit des objets métier typés (profil, contraintes, contexte de recette/étape) ;
- retourne soit un objet structuré validé contre un **JSON Schema** versionné par méthode, soit du texte libre (assistant cuisine) ;
- lève une erreur typée `AIProviderError` en cas d'échec (réseau, quota, sortie invalide), que l'application traduit en message « Service IA momentanément indisponible » (§15.2) et en dégradation gracieuse.

---

## 4. Implémentation développement : `ClaudeCliProvider`

Chaque appel = un `child_process.spawn` du CLI Claude Code en mode non-interactif, sortie JSON, schéma imposé.

### Commande de référence

```bash
claude -p \
  --output-format json \
  --model sonnet \
  --system-prompt "<prompt système de la méthode>" \
  --json-schema '<schéma JSON de la méthode>' \
  --tools "" \
  --setting-sources "" \
  "<prompt métier construit par le backend>"
```

### Rôle de chaque option

| Option | Rôle |
|---|---|
| `-p --output-format json` | Réponse non-interactive ; renvoie un objet `{ result, total_cost_usd, usage, ... }`. Le backend lit `.result` (et peut journaliser le coût). |
| ~~`--json-schema '<…>'`~~ | **Abandonné** — le CLI **n'applique pas** ce flag (voir `docs/adr/0001-cli-json-schema-non-applique.md`). La forme est imposée dans le system prompt, le JSON est extrait des balises Markdown puis validé avec Zod, avec retry borné. |
| `--system-prompt "<…>"` | Remplace le prompt système par défaut → l'app ne dépend pas de la configuration personnelle du développeur. |
| `--tools ""` | Désactive tous les outils → complétion pure, déterministe, sans accès fichiers. |
| `--setting-sources ""` | Empêche le chargement de la config personnelle (`CLAUDE.md`, plugins, MCP) dans les appels de l'app. |
| `--model sonnet \| opus` | Choix du modèle par type de tâche (voir §5). |

### Authentification

Tant que `--bare` **n'est pas** utilisé (cette option force `ANTHROPIC_API_KEY` et ignore l'OAuth), le CLI utilise automatiquement la session abonnement (OAuth) du développeur connecté. Aucune clé à fournir en mode dev.

### Lecture de la réponse

1. Capturer `stdout`.
2. `JSON.parse(stdout)` → objet enveloppe.
3. Lire `.result` (chaîne). Pour les méthodes à schéma, `.result` contient le JSON conforme au `--json-schema` → re-parser et valider.
4. Sur code de sortie non nul ou JSON invalide → lever `AIProviderError`.

### Gestion des erreurs et délais

- Timeout par appel (configurable), aligné sur les cibles §15.1.
- Toute erreur (process, parsing, schéma) → `AIProviderError` → message générique côté app + maintien des fonctionnalités hors-IA (§15.3).

---

## 5. Choix de modèle par méthode

Aliases CLI (`--model`) ; en mode API, mêmes intentions via les identifiants complets.

| Méthode | Modèle dev (alias CLI) | Justification |
|---|---|---|
| `generatePlan` | `opus` | Tâche de raisonnement la plus exigeante |
| `generateRecipe` | `opus` | Qualité de génération |
| `extractRecipe` | `sonnet` | Extraction structurée, bon équilibre coût/latence |
| `cookingAssistant` | `sonnet` | Réponses courtes et rapides (cible < 5 s) |
| `transcribeRecipePhoto` | `sonnet` (Phase 2) | Vision ; voir §6 |

---

## 6. Transcription photo (vision) — résolution

La transcription d'une photo de recette (§5.2.2) nécessite de fournir une image au modèle. En mode `print` avec `--tools ""`, l'entrée est purement textuelle : pas d'image.

**Décision :** la transcription photo est une fonctionnalité de **Phase 2** (conforme au découpage MVP §17.2, où l'import photo n'est pas dans le MVP). Elle n'est donc **pas requise** dans le routage CLI initial. Deux options à l'arrivée de la Phase 2 :
- soit autoriser ponctuellement la lecture d'image pour ces appels (`--tools Read` + `--add-dir <dossier image>`) ;
- soit faire coïncider l'arrivée de la transcription photo avec la bascule vers l'API Anthropic (vision native).

L'interface `AIProvider` expose dès maintenant la méthode `transcribeRecipePhoto` ; `ClaudeCliProvider` la laisse non implémentée (lève `AIProviderError("non disponible en mode CLI")`) tant que la Phase 2 n'est pas atteinte.

---

## 7. Points de vigilance actés

1. **Latence :** démarrer le process du CLI ajoute ~1-3 s par appel. Acceptable en dev. La cible « planning < 15 s » (§15.1) reste large ; « assistant cuisine < 5 s » devient juste — l'API sera plus rapide en production.
2. **Pollution par la config personnelle :** neutralisée par `--system-prompt` (prompt système) et `--setting-sources ""` (mémoire/plugins).
3. **Vision :** non couverte en mode CLI initial (voir §6).
4. **Strictement dev local :** usage personnel de l'abonnement. La bascule API est obligatoire avant tout déploiement (CGU) — voir §1.

---

## 8. Correspondance avec les exigences

| Exigence | Couverture par ce design |
|---|---|
| §14.4 Confidentialité / non-entraînement | En prod, API Anthropic (pas d'entraînement sur données API par défaut). En dev, données traitées sous l'abonnement personnel, en local. |
| §15.1 Latence | Timeouts par appel ; modèles choisis par sensibilité à la latence ; surcoût CLI documenté. |
| §15.2 Coûts/quotas IA | Dev : coût nul (abonnement). Prod : facturation API, volume familial négligeable. `total_cost_usd` journalisable dès le mode CLI. |
| §15.3 Fiabilité | `AIProviderError` → message clair + maintien des fonctions hors-IA. |
| §4.2 Garde-fou allergènes | Hors de la couche IA : filtre déterministe SQL appliqué après chaque réponse provider. |

---

## 9. Hors périmètre de ce design

- Schéma de base de données Supabase, modèle de synchronisation offline/outbox (spec dédiée).
- Contenu des prompts métier eux-mêmes (system prompts et templates) — à concevoir par fonctionnalité.
- UI/UX de l'app.
- Implémentation détaillée de `AnthropicApiProvider` (déclenchée à la bascule production).

---

## 10. Prochaines étapes

1. Plan d'implémentation de la couche `AIProvider` + `ClaudeCliProvider` (interface, sélection par env, spawn, parsing, schémas, gestion d'erreurs).
2. Définition des JSON Schemas par méthode (`generatePlan`, `extractRecipe`, `generateRecipe`).
3. Branchement de la première fonctionnalité MVP consommatrice (planning express).
