# Spécifications Fonctionnelles — Application de Cuisine Familiale IA

**Projet :** Application de cuisine personnelle et familiale assistée par IA  
**Propriétaire :** Usage personnel et familial  
**Version :** 1.0  
**Date :** Juin 2026  
**Statut :** Draft — en cours de validation  

---

## 1. Vision du Produit

### 1.1 Résumé exécutif

L'application est un assistant culinaire familial centré sur l'intelligence artificielle. Son rôle dépasse la simple gestion de recettes : elle planifie activement la semaine alimentaire avec l'utilisateur, mémorise les habitudes et préférences de la famille, accompagne la réalisation des repas en temps réel et génère automatiquement la liste de courses. L'IA est le fil conducteur de toutes les fonctionnalités — elle ne se contente pas de répondre à des commandes, elle anticipe, propose et s'adapte.

### 1.2 Problème résolu

Les solutions existantes (Paprika, Jow, Mealime) proposent soit une gestion de recettes sans intelligence, soit une IA générative sans mémoire personnelle, soit un accès à une bibliothèque fermée de recettes imposées. Aucune n'hybride les trois dimensions suivantes de manière cohérente :

- Utiliser **les propres recettes de l'utilisateur** comme matière première de la planification
- Maintenir une **mémoire contextuelle persistante** de la famille (goûts, refus, historique, budget)
- Offrir un **accompagnement adaptatif en temps réel** pendant la cuisine

### 1.3 Proposition de valeur unique

> L'application agit comme un chef personnel qui connaît intimement ta famille, se souvient de tout ce qui a été cuisiné, adapte ses propositions à vos contraintes du moment, et reste présent à tes côtés du planning jusqu'à l'assiette.

---

## 2. Utilisateurs et Contexte d'Usage

### 2.1 Profil utilisateur principal

- Parent en charge de la planification et de la cuisine familiale
- Niveau en cuisine : intermédiaire à avancé
- Contraintes de temps variables (semaine chargée vs week-end disponible)
- Utilise un iPad en cuisine et un ordinateur pour la planification

### 2.2 Utilisateurs secondaires

- Membres de la famille (conjoint·e, enfants) pouvant consulter le planning et la liste de courses
- Pas de gestion de compte multi-utilisateur dans la version initiale — un profil familial unique

### 2.3 Contextes d'usage principaux

| Contexte | Appareil | Fréquence | Besoins spécifiques |
|---|---|---|---|
| Planification de la semaine | Ordinateur / tablette | Hebdomadaire (sur demande) | Interface spacieuse, interaction IA riche |
| Ajout / import de recettes | Ordinateur / mobile | Ponctuel | Rapidité, capture photo, import URL |
| Préparation des courses | Mobile / tablette | Hebdomadaire | Liste claire, cochable, simple |
| Réalisation d'un repas | iPad en cuisine | Quotidien | Grands boutons, mode mains-libres, IA réactive |
| Consultation du planning | Tous appareils | Quotidien | Vue rapide, lecture seule |

---

## 3. Architecture Fonctionnelle

L'application est organisée en **5 modules** interconnectés, tous alimentés par un moteur IA central.

```
┌─────────────────────────────────────────────────────────┐
│                    MOTEUR IA CENTRAL                    │
│         (mémoire famille + historique + profil)         │
└────┬──────────┬──────────┬──────────┬──────────┬────────┘
     │          │          │          │          │
  MODULE     MODULE     MODULE     MODULE     MODULE
  PROFIL    RECETTES  PLANNING   COURSES    CUISINE
```

---

## 4. Module 1 — Profil Famille (Le "Cerveau" de l'IA)

### 4.1 Description

Le profil famille est le document de référence permanent que l'IA consulte pour toutes ses décisions. Il est rédigé en langage naturel par l'utilisateur, assisté par l'application. Ce n'est pas un formulaire à cases à cocher : c'est un **prompt vivant**, éditable librement, que l'IA interprète de manière contextuelle.

### 4.2 Contenu du profil

L'application guide l'utilisateur pour rédiger son profil en couvrant les dimensions suivantes :

**Composition de la famille**
- Nombre de personnes, âges approximatifs des enfants
- Portions habituelles (ex : "les enfants mangent moitié portion")

**Contraintes alimentaires strictes**
- Allergies (mention obligatoire de la gravité)
- Intolérances
- Exclusions religieuses ou éthiques

**Préférences et dégoûts**
- Ce que les enfants refusent systématiquement
- Les plats favoris de chacun
- Les textures, saveurs ou ingrédients mal tolérés

**Orientations alimentaires**
- Équilibre souhaité (ex : "peu de viande rouge", "légumes à chaque repas")
- Orientations par jour (ex : "végétarien le vendredi")
- Niveau de cuisine habituel en semaine vs week-end

**Contraintes de temps**
- Durée maximale acceptable en semaine (ex : "30 min max le soir")
- Disponibilité plus large le week-end pour des recettes élaborées

**Équipement disponible**
- Appareils spéciaux (Thermomix, cocotte-minute, plancha, four à pizza...)
- Ce qui n'est PAS disponible

**Budget**
- Budget hebdomadaire indicatif pour les courses
- Tolérance aux dépassements occasionnels

### 4.3 Fonctionnement du profil

- **Rédaction assistée** : L'IA pose des questions une par une pour aider l'utilisateur à construire son profil, puis génère une version textuelle cohérente
- **Édition libre** : L'utilisateur peut modifier directement le texte du profil à tout moment
- **Profil enrichi automatiquement** : L'IA peut suggérer des mises à jour du profil après certains événements (ex : "Les enfants ont refusé ce plat 3 fois, souhaitez-vous l'exclure du profil ?")
- **Visibilité** : L'utilisateur voit toujours le contenu exact du profil envoyé à l'IA — pas de boîte noire

### 4.4 User Stories

- En tant qu'utilisateur, je veux être guidé par des questions pour rédiger mon profil famille, afin de ne rien oublier d'important
- En tant qu'utilisateur, je veux pouvoir modifier librement le texte de mon profil à tout moment
- En tant qu'utilisateur, je veux que l'IA me propose des mises à jour du profil basées sur ce qu'elle observe
- En tant qu'utilisateur, je veux voir exactement ce que l'IA sait de ma famille avant qu'elle planifie

---

## 5. Module 2 — Bibliothèque de Recettes

### 5.1 Description

La bibliothèque est le répertoire personnel de toutes les recettes de l'utilisateur. C'est la matière première principale de l'IA pour la planification. Elle contient à la fois les recettes importées/saisies et les recettes générées puis validées par l'IA.

### 5.2 Modes d'ajout d'une recette

#### 5.2.1 Import depuis une URL
- L'utilisateur colle un lien (Marmiton, 750g, BBC Food, blog culinaire...)
- L'IA extrait automatiquement : titre, ingrédients (avec quantités), étapes, temps de préparation, temps de cuisson, nombre de portions
- L'utilisateur valide, corrige ou enrichit les données extraites avant sauvegarde
- En cas d'échec d'extraction, l'utilisateur peut saisir manuellement

#### 5.2.2 Photo d'un livre de cuisine
- L'utilisateur prend une photo d'une page de livre ou d'une fiche recette manuscrite
- L'IA transcrit le contenu et structure les données (ingrédients, étapes, temps)
- L'utilisateur valide avant sauvegarde
- Plusieurs photos pour une même recette (page 1 et page 2) peuvent être combinées

#### 5.2.3 Génération par l'IA
- L'utilisateur décrit une idée ou une contrainte ("une quiche sans gluten pour 4 personnes")
- L'IA génère une recette complète adaptée au profil famille
- L'utilisateur peut demander des ajustements avant de valider et sauvegarder
- La recette générée entre dans la bibliothèque comme n'importe quelle autre recette

#### 5.2.4 Saisie manuelle
- Formulaire structuré : nom, description, catégorie, portions, temps de prep, temps de cuisson, ingrédients (nom + quantité + unité), étapes numérotées, notes libres
- Disponible comme solution de repli ou pour les recettes très simples

### 5.3 Structure d'une recette

Chaque recette contient :

| Champ | Description |
|---|---|
| **Titre** | Nom de la recette |
| **Description courte** | Résumé en 1-2 phrases |
| **Catégorie** | Entrée, plat, dessert, petit-déjeuner, snack... |
| **Tags** | Végétarien, rapide, enfants, festif, hiver... (libres + suggérés par l'IA) |
| **Portions** | Nombre de personnes de base |
| **Temps de préparation** | En minutes |
| **Temps de cuisson** | En minutes |
| **Niveau de difficulté** | Simple / Intermédiaire / Élaboré |
| **Ingrédients** | Liste avec quantités et unités, liés aux portions |
| **Étapes** | Numérotées, avec durée estimée par étape si applicable |
| **Notes** | Astuces, variantes, substitutions possibles |
| **Source** | URL d'origine ou "Généré par IA" ou "Livre : [titre]" |
| **Photo** | Photo de la recette (prise par l'utilisateur ou générée) |
| **Historique** | Nombre de fois réalisée, date de dernière réalisation |
| **Note famille** | Appréciation globale (1 à 5 étoiles) + commentaires libres |

### 5.4 Fonctionnalités de la bibliothèque

- **Recherche** par texte libre (nom, ingrédient, tag)
- **Filtres** : catégorie, durée, difficulté, tag, note famille, "déjà réalisée / jamais testée"
- **Tri** : par date d'ajout, fréquence d'utilisation, note, durée
- **Mise à l'échelle** : ajustement automatique des quantités selon le nombre de portions souhaité
- **Suggestions** : l'IA peut proposer des recettes similaires ou complémentaires à une recette consultée

### 5.5 User Stories

- En tant qu'utilisateur, je veux importer une recette depuis Marmiton en collant un lien, afin de ne pas avoir à la ressaisir
- En tant qu'utilisateur, je veux photographier une page de livre de cuisine et obtenir la recette structurée
- En tant qu'utilisateur, je veux demander à l'IA de créer une recette selon mes contraintes du moment
- En tant qu'utilisateur, je veux filtrer mes recettes par durée pour trouver rapidement quelque chose de rapide en semaine
- En tant qu'utilisateur, je veux voir quelles recettes n'ont pas été faites depuis longtemps

---

## 6. Module 3 — Planification des Repas

### 6.1 Description

Le module de planification est le cœur de l'expérience. L'IA propose un planning de repas pour la semaine (ou une période définie) en s'appuyant sur le profil famille, la bibliothèque de recettes existantes, l'historique des repas passés et les contraintes éventuelles exprimées par l'utilisateur au moment de la demande.

### 6.2 Déclenchement de la planification

La planification se fait **sur demande** — l'utilisateur décide quand lancer le processus. Il n'y a pas de planning auto-généré sans action de sa part.

Deux modes de déclenchement :

**Mode express** : L'utilisateur appuie sur "Planifier ma semaine" → l'IA génère directement une proposition complète basée sur le profil et l'historique, sans questions préalables.

**Mode guidé** : L'utilisateur veut préciser des contraintes spécifiques avant la génération. L'IA pose 2-3 questions contextuelles :
- "Y a-t-il des ingrédients à utiliser en priorité cette semaine ?"
- "As-tu des contraintes particulières (invités, sortie prévue, budget réduit) ?"
- "Veux-tu que je pioche uniquement dans tes recettes existantes ou que j'en propose de nouvelles ?"

### 6.3 Structure du planning

- **Unité de planification** : La semaine (lundi → dimanche) par défaut, mais modifiable (3 jours, 10 jours...)
- **Repas planifiés** : L'utilisateur choisit quels repas inclure (dîners uniquement, + déjeuners, + petits-déjeuners)
- **Vue** : Grille hebdomadaire avec chaque case = un repas, cliquable pour voir la recette

### 6.4 Logique de proposition de l'IA

L'IA construit ses propositions en tenant compte de :

1. **Le profil famille** (allergies, préférences, durée disponible par jour de semaine)
2. **L'historique récent** (ne pas répéter un plat fait il y a moins de X jours — seuil configurable)
3. **L'équilibre nutritionnel** (varier les protéines, légumes, féculents sur la semaine)
4. **L'anti-gaspillage** (si une recette utilise des courgettes, en proposer une autre avec courgettes dans la semaine)
5. **La saisonnalité** (l'IA connaît le mois en cours et favorise les produits de saison)
6. **Le mix connu/nouveau** : par défaut, proposer 70% de recettes de la bibliothèque et 30% de recettes nouvelles générées — ratio ajustable par l'utilisateur

### 6.5 Ajustement du planning

Après génération, l'utilisateur peut :

- **Remplacer un repas** : cliquer sur une case → l'IA propose des alternatives (ou l'utilisateur choisit dans la bibliothèque)
- **Vider une case** : supprimer un repas du planning (repas au restaurant, saut de repas...)
- **Déplacer un repas** : glisser-déposer entre deux jours
- **Demander une explication** : "Pourquoi tu as proposé ça ?" → l'IA explique son raisonnement
- **Régénérer tout** : repartir d'une nouvelle proposition complète

### 6.6 Conversation contextuelle pendant la planification

À tout moment dans la vue planning, l'utilisateur peut écrire à l'IA :
- "J'ai un reste de poulet rôti à finir lundi"
- "Les enfants ne sont pas là mercredi soir, propose quelque chose qu'eux n'aiment pas d'habitude"
- "Remplace le plat de jeudi par quelque chose de plus rapide"

L'IA modifie le planning en conséquence et explique ses choix.

### 6.7 Validation et gel du planning

- L'utilisateur **valide** le planning pour la semaine → les repas entrent dans l'historique comme "planifiés"
- Un planning validé peut toujours être modifié, mais les modifications sont tracées
- Les repas effectivement réalisés peuvent être **marqués comme "fait"** avec ajout d'une note

### 6.8 User Stories

- En tant qu'utilisateur, je veux demander à l'IA de me proposer un planning pour la semaine en un clic
- En tant qu'utilisateur, je veux lui donner des contraintes avant qu'elle planifie (ingrédients à écouler, invités...)
- En tant qu'utilisateur, je veux remplacer un repas proposé et voir des alternatives suggérées par l'IA
- En tant qu'utilisateur, je veux comprendre pourquoi l'IA a proposé tel ou tel plat
- En tant qu'utilisateur, je veux que l'IA ne me propose jamais deux fois le même plat dans un intervalle trop court
- En tant qu'utilisateur, je veux pouvoir converser librement avec l'IA pour ajuster le planning

---

## 7. Module 4 — Courses

### 7.1 Description

Le module courses génère automatiquement la liste d'achats à partir du planning validé. Il intègre des fonctions d'optimisation (anti-gaspillage, regroupement par rayon, gestion d'un stock de base) et permet une gestion manuelle complémentaire.

### 7.2 Génération automatique de la liste

À partir du planning validé, l'application :

1. **Consolide tous les ingrédients** de toutes les recettes planifiées
2. **Calcule les quantités totales** en tenant compte des portions configurées et des ajustements d'échelle
3. **Regroupe par ingrédient** (si "tomates cerise" apparaît dans 3 recettes, totalise en une seule ligne)
4. **Organise par rayon** : Fruits & légumes, Viandes & poissons, Produits laitiers, Épicerie sèche, Surgélés, Boissons, Hygiène/Entretien
5. **Identifie les doublons anti-gaspillage** : signale quand un ingrédient est utilisé dans plusieurs recettes de la semaine

### 7.3 Gestion du stock de base

L'utilisateur peut définir une liste de **produits toujours en stock** (huile, sel, poivre, pâtes, riz, farine, conserves de base...). Ces produits sont exclus par défaut de la liste de courses générée. L'utilisateur peut les réintégrer manuellement s'il en manque.

Le stock de base est une liste fixe, gérée manuellement — il n'y a pas de déduction automatique complexe basée sur les cuissons.

### 7.4 Optimisation anti-gaspillage

L'IA signale dans la liste de courses les **opportunités de réutilisation** :
- "Tu achètes des courgettes pour le gratin de lundi — la soupe de jeudi peut aussi en utiliser"
- "Il te restera de la crème fraîche après la quiche — voilà une idée pour l'utiliser"

Ces suggestions sont optionnelles et non intrusives (affichées dans un panneau dédié, pas dans la liste elle-même).

### 7.5 Fonctionnalités de la liste

- **Ajout manuel** : l'utilisateur peut ajouter des articles hors-recettes (yaourts, jus d'orange, produits ménagers...)
- **Suppression** : retirer un article de la liste (déjà en stock, non désiré)
- **Modification de quantité** : ajuster une quantité directement dans la liste
- **Cochage** : cocher les articles au fur et à mesure des achats → les articles cochés se grisent et descendent en bas de liste
- **Regroupement** : vue par rayon (défaut) ou vue alphabétique
- **Partage** : exporter la liste (texte brut, copier-coller) pour l'envoyer par message

### 7.6 Lien avec le planning

- La liste est **régénérée automatiquement** si le planning est modifié après sa génération
- Si un repas est supprimé du planning après génération de la liste, l'application propose de retirer les ingrédients correspondants
- Les recettes sont accessibles depuis chaque article de la liste ("Utilisé dans : Quiche lorraine, Gratin de courgettes")

### 7.7 User Stories

- En tant qu'utilisateur, je veux obtenir ma liste de courses complète en appuyant sur un bouton après avoir validé mon planning
- En tant qu'utilisateur, je veux que la liste soit organisée par rayon pour être efficace en magasin
- En tant qu'utilisateur, je veux cocher les articles au fur et à mesure de mes achats
- En tant qu'utilisateur, je veux ajouter manuellement des articles hors-recettes à la liste
- En tant qu'utilisateur, je veux définir une liste de produits que j'ai toujours à la maison pour qu'ils n'apparaissent pas dans mes courses
- En tant qu'utilisateur, je veux que l'IA me signale les opportunités pour éviter le gaspillage

---

## 8. Module 5 — Mode Cuisine (Accompagnement en Temps Réel)

### 8.1 Description

Le mode cuisine est l'interface active pendant la réalisation d'un repas. Il est optimisé pour une utilisation **mains libres sur iPad**, avec de grands éléments tactiles, une progression pas-à-pas claire et un accès permanent à l'IA pour toute question ou adaptation en cours de route.

### 8.2 Lancement du mode cuisine

- Depuis le planning : cliquer sur un repas → "Commencer à cuisiner"
- Depuis une recette : bouton "Cuisiner maintenant"
- L'app propose optionnellement une phase de **mise en place** avant de commencer (liste des ustensiles et préparations préalables)

### 8.3 Interface pas-à-pas

**Structure de chaque étape :**
- Numéro et titre de l'étape (ex : "Étape 3 — Faire revenir les oignons")
- Description détaillée de l'action
- Ingrédients nécessaires à cette étape (avec quantités)
- Durée estimée si applicable
- Photo illustrative si disponible

**Navigation entre étapes :**
- Grands boutons "Étape suivante" / "Étape précédente"
- Indicateur de progression (ex : "Étape 3 / 8")
- Vue d'ensemble des étapes restantes accessible en un geste
- Possibilité de revenir à n'importe quelle étape passée

### 8.4 Minuteries intégrées

- Chaque étape avec une durée définie propose un bouton "Démarrer le minuteur" en un tap
- Plusieurs minuteries simultanées possibles (ex : cuisson du riz + sauce en parallèle)
- Chaque minuterie est nommée ("Riz", "Sauce tomate")
- Alerte sonore et visuelle à la fin du temps
- Les minuteries restent visibles en bandeau même en naviguant dans les étapes

### 8.5 Assistant IA en temps réel

Un bouton "Demander à l'IA" est accessible sur chaque étape. L'utilisateur peut poser n'importe quelle question :

**Types de questions prises en charge :**
- **Substitution** : "Je n'ai pas de crème fraîche, que puis-je utiliser ?"
- **Technique** : "C'est quoi la différence entre braiser et mijoter ?"
- **Adaptation** : "La sauce est trop épaisse, comment la rattraper ?"
- **Quantité** : "Je cuisine pour 6 au lieu de 4, comment j'adapte ?"
- **Timing** : "Je suis en avance sur la recette, comment je garde le plat au chaud ?"

L'IA répond en tenant compte du contexte exact : elle sait à quelle étape en est l'utilisateur, quelle recette est en cours, et connaît le profil famille.

### 8.6 Adaptation en cours de recette

Si l'utilisateur signale un problème ou un manque (via l'IA ou via un bouton "Adapter la recette"), l'IA peut :
- Proposer une **substitution d'ingrédient** avec indication de l'impact sur le résultat
- Suggérer une **modification de technique** pour le même résultat
- **Recalculer les quantités** si le nombre de convives change en cours de route
- Signaler les **étapes à modifier** en conséquence

### 8.7 Fin de la session cuisine

À la fin de la dernière étape, l'application propose :
- **Marquer le repas comme "Réalisé"** → entre dans l'historique avec la date
- **Laisser une note** sur le repas : appréciation globale (1-5 étoiles), commentaires libres, réactions de la famille
- **Enregistrer les modifications** faites en cours de route (substitutions, adaptations) → l'IA peut proposer de mettre à jour la recette sauvegardée en conséquence

### 8.8 User Stories

- En tant qu'utilisateur, je veux voir les étapes de ma recette une par une avec de grands textes lisibles depuis le plan de travail
- En tant qu'utilisateur, je veux démarrer un minuteur en un seul tap sans quitter l'étape en cours
- En tant qu'utilisateur, je veux pouvoir avoir plusieurs minuteries actives simultanément
- En tant qu'utilisateur, je veux demander à l'IA de me trouver un substitut pour un ingrédient qui me manque
- En tant qu'utilisateur, je veux noter le repas après l'avoir fait pour que l'IA s'en souvienne
- En tant qu'utilisateur, je veux que l'IA sache exactement où j'en suis dans la recette quand je lui pose une question

---

## 9. Module Transversal — Historique et Mémoire

### 9.1 Description

L'historique est la mémoire à long terme de l'application. Il alimente directement l'IA pour améliorer ses propositions au fil du temps.

### 9.2 Ce qui est enregistré

Pour chaque repas réalisé :
- Date de réalisation
- Recette utilisée
- Nombre de personnes
- Note (1-5 étoiles)
- Commentaires libres
- Substitutions ou adaptations effectuées
- Source de la recette dans le planning (proposée par l'IA ou choisie manuellement)

### 9.3 Ce que l'IA fait de cet historique

- **Éviter les répétitions** : paramètre configurable "ne pas reproposer un plat réalisé depuis moins de X jours" (X = 7, 14, 21, 30 jours au choix)
- **Apprendre les préférences** : un plat très bien noté remonte dans les suggestions ; un plat mal noté descend
- **Enrichir le profil** : si un plat est systématiquement mal noté par la famille, l'IA peut proposer de mettre à jour le profil
- **Créer de la variété** : l'IA évite de proposer deux repas du même type dans un intervalle court (deux gratins la même semaine, deux poissons consécutifs...)

### 9.4 Consultation de l'historique

- Vue chronologique (journal des repas)
- Vue par recette (fréquence, notes, évolution)
- Statistiques simples : repas les plus souvent cuisinés, note moyenne par catégorie, équilibre viande/poisson/végétarien sur le mois

### 9.5 User Stories

- En tant qu'utilisateur, je veux voir un journal de tout ce que ma famille a mangé
- En tant qu'utilisateur, je veux que l'IA ne me propose jamais deux fois le même plat dans un délai que je définis
- En tant qu'utilisateur, je veux voir quelles recettes sont les favorites de ma famille
- En tant qu'utilisateur, je veux que l'IA améliore ses propositions en fonction de ce que nous avons aimé ou non

---

## 10. Expérience IA — Principes Directeurs

### 10.1 Transparence

L'IA ne doit jamais agir en boîte noire. Chaque décision importante peut être expliquée :
- "Pourquoi ce plat ce soir ?" → réponse contextuelle
- Le contenu exact du profil famille est toujours visible et accessible
- Les critères utilisés pour générer le planning sont consultables

### 10.2 Contrôle utilisateur

L'IA propose, l'utilisateur décide. Aucune action automatique irréversible ne se produit sans validation. L'utilisateur peut :
- Rejeter n'importe quelle proposition
- Demander une alternative
- Ignorer une suggestion
- Modifier manuellement tout ce que l'IA a généré

### 10.3 Tonalité de l'IA

- Chaleureuse et directe, pas formelle
- Concise dans les réponses rapides (mode cuisine)
- Plus détaillée quand c'est utile (explication d'un choix, génération d'une recette)
- Jamais condescendante sur les choix alimentaires

### 10.4 Gestion des limites

Quand l'IA ne sait pas ou ne peut pas répondre de façon fiable :
- Elle le dit clairement
- Elle propose une alternative (chercher sur internet, consulter un professionnel pour les allergies graves...)
- Elle ne fabrique jamais d'information pour paraître utile

---

## 11. Flux Utilisateur Principaux

### 11.1 Flux — Première utilisation

```
Ouverture de l'app
→ Écran de bienvenue (présentation de l'app)
→ "Créer mon profil famille" (assistant IA guidé)
→ L'IA pose des questions sur la famille, les goûts, les contraintes
→ Validation du profil généré
→ Option : "Importer mes premières recettes" ou "Explorer l'app d'abord"
→ Tableau de bord principal
```

### 11.2 Flux — Planification hebdomadaire

```
Tableau de bord → "Planifier ma semaine"
→ Choix du mode (Express / Guidé)
→ [Mode Guidé] L'IA pose 2-3 questions contextuelles
→ L'IA génère un planning complet
→ L'utilisateur révise, ajuste, remplace des repas
→ Conversation libre avec l'IA pour affiner
→ "Valider ce planning"
→ Option immédiate : "Générer ma liste de courses"
```

### 11.3 Flux — Import d'une recette

```
Bibliothèque → "Ajouter une recette"
→ Choix du mode : URL / Photo / IA génère / Manuel
→ [URL] Coller le lien → l'IA extrait les données → prévisualisation → corrections → Sauvegarder
→ [Photo] Prendre/importer la photo → l'IA transcrit → prévisualisation → corrections → Sauvegarder
→ [IA] Décrire la recette souhaitée → l'IA génère → ajustements → Sauvegarder
→ [Manuel] Remplir le formulaire → Sauvegarder
```

### 11.4 Flux — Session cuisine

```
Planning → Repas du jour → "Cuisiner maintenant"
→ [Optionnel] Mise en place (ustensiles, préparations préalables)
→ Étape 1 / N — description + ingrédients de l'étape
→ [Optionnel] Démarrage minuteur
→ Navigation étape par étape
→ À tout moment : "Demander à l'IA" → question libre → réponse contextuelle
→ Dernière étape → "Repas terminé !"
→ Noter le repas (étoiles + commentaire)
→ Retour au tableau de bord
```

### 11.5 Flux — Génération de la liste de courses

```
Planning validé → "Générer la liste de courses"
→ L'app consolide tous les ingrédients de la semaine
→ Retrait automatique du stock de base
→ Liste organisée par rayon
→ Révision : ajout / suppression / modification manuelle
→ Suggestions anti-gaspillage de l'IA (panneau latéral)
→ Liste prête → Courses
→ Cochage au fil des achats
```

---

## 12. Plateformes et Compatibilité

### 12.1 Cibles

L'application doit fonctionner de manière optimale sur les trois plateformes suivantes, avec une expérience adaptée à chaque contexte d'usage :

| Plateforme | Contexte principal | Priorité |
|---|---|---|
| **iPad** | Mode cuisine (mains libres, grands éléments) | Haute |
| **Ordinateur (macOS/Web)** | Planification, gestion bibliothèque | Haute |
| **iPhone / Mobile** | Consultation rapide, courses en magasin | Haute |

### 12.2 Principes d'adaptation

**iPad en mode cuisine :**
- Éléments tactiles très grands (étapes, minuteurs, bouton IA)
- Texte lisible à distance (grand corps de texte)
- Interface épurée, pas de distraction
- Mode portrait et paysage supportés

**Ordinateur / Web :**
- Interface plus dense, plus d'informations visibles simultanément
- Vue planning en grille complète sur une page
- Navigation clavier supportée
- Idéal pour la gestion de la bibliothèque et la planification

**Mobile :**
- Navigation simplifiée, thumb-friendly
- Liste de courses prioritaire (usage principal en mobilité)
- Consultation du planning et des recettes
- Accès complet à toutes les fonctionnalités mais interface condensée

### 12.3 Connectivité

L'application nécessite une **connexion internet active** pour toutes les fonctionnalités IA (planification, génération, accompagnement cuisine). Les données locales (recettes, planning, liste de courses) restent accessibles hors connexion en lecture seule.

---

## 13. Gestion des Données

### 13.1 Données utilisateur

| Type de donnée | Stockage | Sensibilité |
|---|---|---|
| Profil famille | Local + cloud | Haute (allergies, données personnelles) |
| Bibliothèque de recettes | Local + cloud | Faible |
| Historique des repas | Local + cloud | Faible |
| Planning en cours | Local + cloud | Faible |
| Liste de courses | Local (session) | Très faible |

### 13.2 Export et portabilité

L'utilisateur peut exporter :
- Ses recettes (format PDF ou texte structuré)
- Son historique (format tableau)
- Sa liste de courses (texte brut pour partage)

### 13.3 Ce qui est envoyé à l'IA

À chaque interaction, l'IA reçoit :
- Le contenu du profil famille
- Le contexte de la demande (module actif, recette en cours, planning actuel...)
- Les données pertinentes pour la réponse (historique récent pour la planification, étapes de la recette pour le mode cuisine)

L'utilisateur peut consulter à tout moment un résumé de ce qui est partagé avec l'IA.

---

## 14. Fonctionnalités Hors Périmètre (Version 1.0)

Les éléments suivants sont volontairement exclus de la première version pour maintenir la cohérence et la faisabilité du projet :

- Compte multi-utilisateurs distincts (chaque membre de la famille avec son propre profil)
- Intégration directe avec des services de livraison de courses (Intermarché, Amazon Fresh...)
- Calcul nutritionnel détaillé (calories, macros, micronutriments)
- Mode hors-ligne complet pour les fonctionnalités IA
- Partage public de recettes ou réseau social culinaire
- Scan de ticket de caisse pour mise à jour automatique du stock
- Reconnaissance d'ingrédients par photo (contenu du frigo)
- Planification de repas sur plusieurs semaines avec budget cumulé
- Notifications push programmées ("Il est 17h, voici le repas de ce soir")

---

## 15. Glossaire

| Terme | Définition dans le contexte de l'application |
|---|---|
| **Profil famille** | Document texte permanent décrivant la composition, les goûts et les contraintes de la famille, utilisé par l'IA comme contexte de base |
| **Bibliothèque** | Ensemble des recettes sauvegardées par l'utilisateur |
| **Planning** | Grille hebdomadaire associant des recettes à des repas et des jours |
| **Mode Express** | Génération de planning sans questions préalables |
| **Mode Guidé** | Génération de planning précédée d'un échange contextuel avec l'IA |
| **Stock de base** | Liste de produits considérés comme toujours disponibles à la maison, exclus des listes de courses |
| **Mode Cuisine** | Interface plein écran optimisée pour la réalisation d'une recette étape par étape |
| **Historique** | Journal de tous les repas réalisés avec leurs notes et commentaires |
| **Mise en place** | Phase préparatoire optionnelle avant de commencer la cuisine (rassembler ustensiles et ingrédients) |

