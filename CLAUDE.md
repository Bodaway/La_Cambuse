# La Cambuse — Guide de développement

Application de cuisine familiale assistée par IA : planification des repas, bibliothèque de recettes, liste de courses, mode cuisine. Voir `docs/specifications-fonctionnelles.md` (v1.1) pour le fonctionnel et `docs/superpowers/specs/` pour les designs techniques.

## Stack

- **Langage** : TypeScript, ESM (`"type": "module"`, `moduleResolution: NodeNext`). Node 22+.
- **Gestionnaire de paquets** : **pnpm** (jamais `npm`/`yarn`). Imports relatifs avec extension `.js`.
- **Paradigme** : programmation fonctionnelle stricte (voir section dédiée).
- **Gestion d'erreurs** : `Result`/`ResultAsync` via **neverthrow** — pas d'exceptions dans la logique métier.
- **Tests** : **Vitest** (unité/logique) + **Playwright** (E2E navigateur).
- **Validation / schémas** : Zod v4 (`z.toJSONSchema` pour générer les JSON Schema).
- **Exécution de process** : execa (gère `claude.cmd` sous Windows).
- **Plateforme cible** : web app responsive (PWA), base de code unique iPad/desktop/mobile.
- **Backend & synchro** (à venir) : Supabase (Postgres + Auth + Realtime + Storage) + cache IndexedDB et file d'attente d'écritures (offline).

## Paradigme — Programmation fonctionnelle stricte

**Non négociable.** Tout le code suit ces règles :

- **Zéro classe.** La logique s'exprime en **fonctions pures** et **closures**. Un « composant » est une *factory* (`createX(deps)`) qui renvoie un objet de fonctions. Pas de `class`, pas de `this`, pas de `new` (sauf objets natifs imposés par une lib, alors encapsulés à la frontière).
- **Immutabilité partout.** `readonly` sur les types, `const` par défaut, aucune mutation en place. Utiliser spread / `map` / `filter` / `reduce` plutôt que `push`/`splice`/réassignation.
- **Pas d'exceptions dans la logique métier.** Toute opération faillible renvoie `Result<T, AppError>` (ou `ResultAsync`). Les erreurs sont des **objets simples étiquetés** (unions discriminées), jamais des classes d'`Error`. Les exceptions levées par des libs sont capturées **aux frontières** (`ResultAsync.fromPromise`) et converties en `Result`.
- **Effets de bord isolés aux frontières.** I/O, process, réseau, base de données vivent en périphérie ; le cœur métier reste pur et testable sans mock.
- **Composition.** Préférer `pipe` / `.map` / `.andThen` au code impératif et aux `try/catch` épars.
- **Injection de dépendances par paramètre.** Les fonctions reçoivent leurs dépendances (ex. un `CommandRunner`) en argument → testables avec des doublures simples.
- **Types stricts.** Jamais de `any`. Unions discriminées pour les variantes. `as const` pour les littéraux.

## Conventions

- **Langue** : identifiants (variables, fonctions, types, fichiers) en **anglais** ; commentaires, docs, chaînes destinées à l'utilisateur et **messages de commit** en **français**.
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). Sujet en français.
- **TDD strict** : écrire le test, vérifier qu'il échoue, implémenter le minimum, vérifier qu'il passe, committer. Pas de code de production sans test préalable.
- **DRY, YAGNI** : pas d'abstraction prématurée, pas de fonctionnalité non demandée.
- **Fichiers focalisés** : une responsabilité par fichier ; préférer plusieurs petits fichiers à un gros.
- **Nommage de fichiers** : kebab-case (`claude-cli-provider.ts`).

## Tests & livraison continue

Objectif : **continuous delivery** — chaque incrément est petit, testé, et déployable.

- **Tout est lourdement testé**, à deux niveaux :
  - **Vitest** — logique et fonctions pures (rapides, déterministes).
  - **Playwright** — parcours utilisateur de bout en bout dans le navigateur.
- **Aucun appel réel** (réseau, CLI Claude, IA, Supabase) dans les tests : injecter des doublures. En E2E, mocker la couche IA et le backend si nécessaire.
- **CI = porte de fusion.** La pipeline exécute `pnpm typecheck`, le lint, Vitest **et** Playwright. Rien ne fusionne sans suite entièrement verte.
- **Petits incréments** : une user story (ou sous-tâche) par PR, livrable indépendamment.

## Documentation vivante

À maintenir à jour **à chaque livraison**, pas après coup :

- **ADR** (`docs/adr/NNNN-titre.md`) — une décision d'architecture par fichier : contexte, décision, conséquences. Toute décision technique structurante donne lieu à un ADR.
- **Doc par user story** (`docs/user-stories/`) — chaque user story reliée à ses critères d'acceptation (cf. spec §18) et au statut des tests qui la couvrent (Vitest / Playwright). Mise à jour quand la story avance.
- **Designs & plans** — `docs/superpowers/specs/` (designs techniques), `docs/superpowers/plans/` (plans d'implémentation).

## Règles d'architecture (non négociables)

- **Le code métier ne dépend que de l'interface `AIProvider`** — jamais du CLI Claude ni de l'API Anthropic directement. La sélection se fait via `AI_PROVIDER` (`cli` en dev, `api` en prod). Voir `docs/superpowers/specs/2026-06-22-routage-ia-claude-cli-design.md`.
- **Sécurité allergènes** : le filtre allergènes est **déterministe (SQL), jamais via le LLM**, et s'applique en aval de toute réponse IA (recette, substitution). Aucune logique de sécurité allergènes dans la couche IA.
- **Mode CLI = dev local uniquement** : `ClaudeCliProvider` utilise l'abonnement personnel ; interdit en déploiement. Ne jamais utiliser le flag `--bare` (il force `ANTHROPIC_API_KEY` et casse l'auth abonnement).
- **Secrets** : aucune clé API ni identifiant ne doit être commitée. Variables d'environnement uniquement ; `.env` dans `.gitignore`.
- **L'IA propose, l'utilisateur décide** : aucune action automatique irréversible sans validation (cf. spec §10.2).

## Commandes

```bash
pnpm install        # installer les dépendances
pnpm test           # suite unitaire (vitest run)
pnpm test:watch     # vitest en mode watch
pnpm test:e2e       # Playwright (E2E)
pnpm typecheck      # tsc --noEmit
pnpm lint           # lint
pnpm exec vitest run <chemin>   # un fichier de test précis
```

## Organisation

- `src/ai/` — couche d'accès IA (interface `AIProvider`, provider CLI, `CommandRunner`, schémas, fabrique).
- `docs/specifications-fonctionnelles.md` — spec fonctionnelle (référence produit).
- `docs/revue-specifications.md` — revue critique de la spec.
- `docs/adr/` — décisions d'architecture (ADR).
- `docs/user-stories/` — doc vivante par user story + critères d'acceptation.
- `docs/superpowers/specs/` — designs techniques.
- `docs/superpowers/plans/` — plans d'implémentation.

## Workflow

- Branche dédiée par chantier (`design/…`, `feat/…`, `fix/…`) ; ne pas committer directement sur `main`.
- Suivre les plans de `docs/superpowers/plans/` tâche par tâche (TDD, commits fréquents).
- Une user story par PR ; ADR et doc user story mis à jour dans la même PR.
