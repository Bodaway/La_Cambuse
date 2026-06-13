# Revue des Spécifications Fonctionnelles — v1.0

**Document revu :** `specifications-fonctionnelles.md` (v1.0, Juin 2026)
**Date de la revue :** 12 juin 2026
**Verdict global :** Document de très bonne qualité — vision claire, périmètre bien délimité (section 14), user stories concrètes. Les points ci-dessous doivent être tranchés avant de passer en conception/développement.

---

## 1. Problèmes critiques (à résoudre avant développement)

### 1.1 Sécurité alimentaire : allergies et IA générative ⚠️

C'est le point le plus important du document. Le profil mentionne des **allergies avec gravité** (§4.2), et l'IA :
- génère des recettes complètes (§5.2.3),
- propose des **substitutions d'ingrédients en plein mode cuisine** (§8.5, §8.6).

Or une IA générative peut se tromper (allergène caché dans un ingrédient composé, substitution contenant l'allergène). La section 10.4 effleure le sujet mais ne suffit pas. **Ajout nécessaire :**
- Un contrôle **déterministe** (non-IA) des ingrédients contre la liste d'allergènes du profil, appliqué à toute recette générée, importée ou substituée.
- Un avertissement explicite affiché pour les allergies graves ("vérifiez toujours les étiquettes").
- Une règle : l'IA ne propose **jamais** de substitution impliquant un allergène déclaré, même sur demande.

### 1.2 Contradiction : accès des membres de la famille sans multi-compte

- §2.2 : les membres de la famille "peuvent consulter le planning et la liste de courses".
- §2.2 et §14 : pas de multi-compte, profil familial unique.

**Comment le conjoint accède-t-il à la liste en magasin ?** Appareil partagé ? Compte unique connecté sur plusieurs appareils ? Lien de partage en lecture seule ? Le seul mécanisme spécifié est l'export texte (§7.5), ce qui est faible pour un usage quotidien. À trancher explicitement.

### 1.3 Contradiction : liste de courses "Local (session)" vs usage multi-appareils

§13.1 indique que la liste de courses est stockée en **local (session)**, mais :
- §2.3 : la liste est préparée sur ordinateur/tablette et utilisée **sur mobile en magasin** ;
- §7.5 : le cochage progressif suppose une persistance.

Si la liste ne se synchronise pas via le cloud, le flux principal (§11.5) est cassé. La liste devrait être "Local + cloud" comme le planning.

### 1.4 Aucune section authentification / comptes

Le document mentionne un stockage cloud (§13.1) et un usage multi-appareils, mais **aucune spécification de connexion** : création de compte, méthode d'authentification, récupération d'accès. Section à ajouter, même minimale (ex. : un compte unique par famille, connexion par e-mail).

### 1.5 Mode cuisine et perte de connexion

§12.3 : les données locales sont accessibles **en lecture seule** hors connexion. Mais le mode cuisine (navigation pas-à-pas, minuteurs, marquage "réalisé") ne nécessite pas l'IA — il serait inacceptable de perdre la recette en cours au milieu d'une cuisson à cause d'une coupure réseau. **À spécifier :** le mode cuisine fonctionne intégralement hors ligne (hors assistant IA), avec dégradation gracieuse du bouton "Demander à l'IA".

---

## 2. Incohérences et ambiguïtés

### 2.1 "Mains libres" sans interaction vocale (§8.1)

Le mode cuisine est annoncé "mains libres", mais toute l'interface décrite est **tactile** (boutons, taps). Aucune commande vocale n'est spécifiée, et elle n'apparaît pas non plus dans les exclusions (§14). Soit spécifier l'interaction vocale (au moins "étape suivante" et questions à l'IA), soit reformuler en "utilisable avec les mains occupées/sales" et ajouter la voix au hors-périmètre.

### 2.2 Alertes de minuteurs vs notifications hors périmètre (§8.4 / §14)

Les notifications push sont hors périmètre, mais les minuteurs exigent une "alerte sonore et visuelle". Que se passe-t-il si l'iPad se verrouille ou si l'app passe en arrière-plan ? Distinguer **notifications locales** (nécessaires aux minuteurs, dans le périmètre) et **push marketing/rappels** (hors périmètre).

### 2.3 Régénération automatique de la liste vs modifications manuelles (§7.6)

La liste est "régénérée automatiquement si le planning est modifié", mais l'utilisateur peut l'avoir éditée (ajouts manuels, quantités ajustées, articles cochés). **Règle de fusion à définir :** les ajouts manuels et le cochage survivent à la régénération ; seuls les ingrédients issus des recettes sont recalculés.

### 2.4 Budget sans données de prix (§4.2, §6.2)

Le profil contient un budget hebdomadaire et le mode guidé évoque un "budget réduit", mais l'application n'a **aucune source de prix**. L'IA ne peut faire qu'une estimation qualitative ("semaine économique"). À assumer explicitement comme une limitation, sinon l'attente utilisateur sera déçue.

### 2.5 Consolidation des ingrédients et unités (§7.2)

Regrouper "200 g de tomates cerises" + "1 barquette de tomates cerise" + "2 c. à s. de concentré de tomate" est un problème difficile : **normalisation des noms** (singulier/pluriel, synonymes) et **conversion d'unités** (g ↔ pièce ↔ cuillère). Spécifier qui fait cette fusion (règles déterministes, IA, ou validation utilisateur en cas d'ambiguïté).

### 2.6 Mise à jour d'une recette après adaptations (§8.7)

"L'IA peut proposer de mettre à jour la recette sauvegardée" — écrase-t-on la recette d'origine ou crée-t-on une variante/version ? Si on écrase, l'historique des repas passés pointe vers une recette modifiée. Recommandation : conserver la version d'origine (variante ou historique de versions simple).

### 2.7 Suppression d'une recette référencée

Aucun comportement défini pour la suppression d'une recette présente dans un planning actif ou dans l'historique. Recommandation : suppression douce (archivage) pour préserver l'historique.

---

## 3. Sections manquantes (ajouts recommandés)

### 3.1 Exigences non fonctionnelles

Section absente. À minima :
- **Latence IA** : temps de réponse acceptable en mode cuisine (réponse rapide attendue, ex. < 5 s) vs planification (plus tolérant).
- **Coûts IA** : fournisseur du modèle, budget d'utilisation, comportement en cas de quota atteint.
- **Fiabilité** : comportement en cas d'erreur ou d'indisponibilité de l'API IA dans chaque module.

### 3.2 Confidentialité et RGPD

Le profil famille contient des **données de santé** (allergies) et des informations sur des **enfants**, envoyées à une API IA tierce (§13.3). Même pour un usage personnel, ajouter :
- le fournisseur IA pressenti et sa politique de conservation des données (opt-out de l'entraînement) ;
- la possibilité de supprimer toutes les données (profil, historique, cloud).

### 3.3 Priorisation / découpage MVP

Tous les modules sont au même niveau. Pour un projet personnel, un phasage est essentiel pour livrer vite. Suggestion :
1. **MVP** : Bibliothèque (import URL + manuel) + Profil + Planning express + Liste de courses.
2. **Phase 2** : Mode cuisine complet, import photo, historique enrichi.
3. **Phase 3** : Anti-gaspillage, suggestions proactives, statistiques.

### 3.4 Critères d'acceptation

Les user stories n'ont pas de critères d'acceptation. Pas bloquant à ce stade, mais à ajouter au moins pour les flux critiques (import URL, génération de planning, consolidation des courses).

### 3.5 Import URL : cas limites

§5.2.1 prévoit l'échec d'extraction, mais pas : les sites avec paywall ou anti-scraping, les vidéos de recettes (URL YouTube ?), les pages en langues étrangères (traduire ou conserver ?). À préciser, ne serait-ce que pour les exclure.

### 3.6 Photos : stockage et génération (§5.3)

Le champ Photo mentionne "prise par l'utilisateur **ou générée**" — la génération d'images est une fonctionnalité à part entière (coût, qualité) qui n'apparaît nulle part ailleurs. La confirmer ou la retirer. Préciser aussi le stockage des photos (poids, cloud).

---

## 4. Remarques mineures

- **§6.4 Saisonnalité** : "l'IA connaît le mois en cours" — préciser aussi la zone géographique (saisons de l'hémisphère nord / France) dans le profil ou la configuration.
- **§6.7** : les modifications d'un planning validé "sont tracées" — où cette trace est-elle visible ? Si nulle part, simplifier en retirant la mention.
- **§5.3 Historique dans la recette** vs **§9 module Historique** : redondance assumée ? Préciser que le champ de la recette est dérivé du module Historique (une seule source de vérité).
- **Langue et unités** : l'application est implicitement en français avec unités métriques — l'écrire (et exclure explicitement l'i18n de la v1).
- **§12.1** : "Ordinateur (macOS/Web)" — la spec fonctionnelle n'a pas à trancher la techno, mais noter que la cible "3 plateformes, priorité haute partout" est ambitieuse pour une v1 ; une web app responsive couvrirait les trois.

---

## 5. Synthèse

| Catégorie | Nombre | Exemples |
|---|---|---|
| Critiques | 5 | Garde-fou allergies, accès famille, sync liste de courses, authentification, mode cuisine hors ligne |
| Incohérences | 7 | Mains libres sans voix, minuteurs vs notifications, régénération de liste, budget sans prix |
| Sections manquantes | 6 | Exigences non fonctionnelles, RGPD, MVP, critères d'acceptation |
| Mineures | 5 | Saisonnalité, traçage, redondance historique, langue, plateformes |

Le document est prêt pour une **v1.1** intégrant en priorité : le garde-fou allergies (§1.1), la clarification de l'accès famille et de la synchronisation (§1.2–1.4), et le découpage MVP (§3.3).
