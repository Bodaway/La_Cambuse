# ADR 0001 — Le CLI Claude Code n'applique pas `--json-schema`

**Date :** 22 juin 2026
**Statut :** Accepté

## Contexte

Le design du routage IA (`docs/superpowers/specs/2026-06-22-routage-ia-claude-cli-design.md`) supposait que l'option `--json-schema` du CLI Claude Code contraignait et validait la sortie structurée (ex. génération de planning).

À la première exécution réelle, `generatePlan` échouait (`schema_validation_failed` / `invalid_output`). Reproduction via `execa` exactement comme l'app :

- Le CLI **ignore `--json-schema`** : la sortie ne respecte ni la forme demandée ni l'absence de texte.
- La sortie est parfois enrobée de balises Markdown (` ```json … ``` `), parfois d'une structure arbitraire (`planning.jours[].repas…`).
- La sortie est **non déterministe** : sur des appels identiques, tantôt conforme, tantôt non.

## Décision

Ne pas s'appuyer sur `--json-schema`. À la place, pour toute sortie structurée :

1. **Imposer la forme exacte dans le system prompt** (champs attendus, « aucun texte ni balise Markdown »).
2. **Extraire le JSON** en retirant un éventuel bloc Markdown ` ```json … ``` ` avant le parsing.
3. **Valider avec Zod** (filet de sécurité déterministe) — la source de vérité de la forme reste le schéma Zod.
4. **Réessayer (borné, 2 fois)** sur erreur de forme (`invalid_output` / `schema_validation_failed`), car la déviation est probablement transitoire. Ne pas réessayer sur `process_failed` / `unsupported`.

## Conséquences

- `generatePlan` (et toute future méthode structurée) est fiable malgré le non-déterminisme du LLM ; vérifié en live (appels réels `/api/ai` → 200 conformes).
- Le system prompt doit rester synchronisé avec le schéma Zod (forme dupliquée). Acceptable tant que les schémas sont simples ; à revoir si la forme se complexifie (génération du prompt depuis le schéma).
- Coût : jusqu'à 3 appels modèle en cas de déviations répétées (rare).
- À la bascule vers l'API Anthropic (prod), on utilisera les sorties structurées natives de l'API (`output_config.format`), ce qui rendra ce contournement inutile côté API.
