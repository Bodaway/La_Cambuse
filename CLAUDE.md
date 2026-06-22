# La Cambuse — Guide de développement

Application de cuisine familiale assistée par IA : planification des repas, bibliothèque de recettes, liste de courses, mode cuisine. Voir `docs/specifications-fonctionnelles.md` (v1.1) pour le fonctionnel et `docs/superpowers/specs/` pour les designs techniques.

## Stack

- **Langage** : TypeScript, ESM (`"type": "module"`, `moduleResolution: NodeNext`). Node 22+.
- **Gestionnaire de paquets** : **pnpm** (jamais `npm`/`yarn`). Imports relatifs avec extension `.js`.
- **Tests** : Vitest.
- **Validation / schémas** : Zod v4 (`z.toJSONSchema` pour générer les JSON Schema).
- **Exécution de process** : execa (gère `claude.cmd` sous Windows).
- **Plateforme cible** : web app responsive (PWA), base de code unique iPad/desktop/mobile.
- **Backend & synchro** (à venir) : Supabase (Postgres + Auth + Realtime + Storage) + cache IndexedDB et file d'attente d'écritures (offline).

## Conventions

- **Langue** : identifiants (variables, fonctions, types, fichiers) en **anglais** ; commentaires, docs, chaînes destinées à l'utilisateur et **messages de commit** en **français**.
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). Sujet en français.
- **TDD strict** : écrire le test, vérifier qu'il échoue, implémenter le minimum, vérifier qu'il passe, committer. Pas de code de production sans test préalable.
- **DRY, YAGNI** : pas d'abstraction prématurée, pas de fonctionnalité non demandée.
- **Fichiers focalisés** : une responsabilité par fichier ; préférer plusieurs petits fichiers à un gros.

## Règles d'architecture (non négociables)

- **Le code métier ne dépend que de l'interface `AIProvider`** — jamais du CLI Claude ni de l'API Anthropic directement. La sélection se fait via `AI_PROVIDER` (`cli` en dev, `api` en prod). Voir `docs/superpowers/specs/2026-06-22-routage-ia-claude-cli-design.md`.
- **Sécurité allergènes** : le filtre allergènes est **déterministe (SQL), jamais via le LLM**, et s'applique en aval de toute réponse IA (recette, substitution). Aucune logique de sécurité allergènes dans la couche IA.
- **Mode CLI = dev local uniquement** : `ClaudeCliProvider` utilise l'abonnement personnel ; interdit en déploiement. Ne jamais utiliser le flag `--bare` (il force `ANTHROPIC_API_KEY` et casse l'auth abonnement).
- **Secrets** : aucune clé API ni identifiant ne doit être commitée. Variables d'environnement uniquement.
- **L'IA propose, l'utilisateur décide** : aucune action automatique irréversible sans validation (cf. spec §10.2).

## Commandes

```bash
pnpm install        # installer les dépendances
pnpm test           # lancer toute la suite (vitest run)
pnpm test:watch     # mode watch
pnpm typecheck      # tsc --noEmit
pnpm exec vitest run <chemin>   # un fichier de test précis
```

## Organisation

- `src/ai/` — couche d'accès IA (interface `AIProvider`, `ClaudeCliProvider`, `CommandRunner`, schémas, fabrique).
- `docs/specifications-fonctionnelles.md` — spec fonctionnelle (référence produit).
- `docs/revue-specifications.md` — revue critique de la spec.
- `docs/superpowers/specs/` — designs techniques.
- `docs/superpowers/plans/` — plans d'implémentation.

## Workflow

- Branche dédiée par chantier ; ne pas committer directement sur `main`.
- Suivre les plans de `docs/superpowers/plans/` tâche par tâche (TDD, commits fréquents).
