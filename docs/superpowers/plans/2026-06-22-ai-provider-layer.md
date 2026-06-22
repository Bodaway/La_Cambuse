# Couche AIProvider (routage IA via CLI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la couche d'accès IA du backend en **style fonctionnel strict** : une interface `AIProvider` (objet de fonctions renvoyant des `ResultAsync`) consommée par tout le code métier, et une implémentation routant les appels vers le CLI Claude Code en développement, avec bascule API ultérieure par simple variable d'environnement.

**Architecture:** Aucune classe. Chaque « composant » est une *factory* (`createX(deps)`) renvoyant un objet de fonctions pures + closures. Les erreurs sont des objets étiquetés (`AIError`) ; aucune exception n'est levée — tout passe par `Result`/`ResultAsync` (neverthrow). `createClaudeCliProvider(runner)` construit les arguments CLI (`-p --output-format json --system-prompt … --tools "" --setting-sources ""`, plus `--json-schema` pour les sorties structurées), passe le prompt en stdin via un `CommandRunner` injecté (réel basé sur `execa`, factice en test), parse l'enveloppe JSON et valide la sortie structurée avec Zod. `createAIProvider(env)` renvoie un `Result<AIProvider, AIError>` selon `AI_PROVIDER`.

**Tech Stack:** TypeScript (ESM, NodeNext), Node 22+, pnpm, Vitest, neverthrow (`Result`/`ResultAsync`), Zod v4 (`z.toJSONSchema`), execa v9, ESLint flat + typescript-eslint + eslint-plugin-functional (FP imposé), Prettier.

## Global Constraints

- **Paradigme fonctionnel strict** (cf. `CLAUDE.md`) : zéro classe, zéro `this`, zéro `let` (hors tests), immutabilité (`readonly`), aucune boucle, **aucun `throw`** — toute faille renvoie `Result`/`ResultAsync`. Le linter `eslint-plugin-functional` impose ces règles.
- **Erreurs** : objets étiquetés `AIError = { readonly code; readonly message; readonly cause? }` créés par la factory `aiError(...)`. Jamais de classe `Error` métier.
- **Dev local uniquement** : le provider CLI utilise l'abonnement du développeur ; interdit en déploiement. L'implémentation API (`AnthropicApiProvider`) est hors périmètre de ce plan.
- **Le code métier ne dépend que de l'interface `AIProvider`** — jamais du CLI ni de l'API directement.
- **Aucune responsabilité allergènes dans cette couche** : le filtre déterministe (SQL) s'applique en aval.
- **Ne jamais utiliser `--bare`** (force `ANTHROPIC_API_KEY`, casse l'auth abonnement).
- **Arguments CLI obligatoires** : `-p`, `--output-format json`, `--system-prompt <…>`, `--tools ""`, `--setting-sources ""`, `--model <alias>`. Prompt métier via **stdin**.
- **Modèles** : `generatePlan` → `opus` ; `cookingAssistant` → `sonnet`.
- **Vision (transcription photo)** : non disponible en mode CLI (Phase 2) — la fonction existe mais renvoie une erreur `unsupported`.
- **Plateforme de dev : Windows** — d'où `execa`.
- **Playwright** : hors périmètre de ce plan (aucune UI ici — couche backend). Les tests E2E entreront avec la première fonctionnalité d'interface.

---

## File Structure

- `package.json`, `tsconfig.json`, `vitest.config.ts` — scaffold. (`eslint.config.mjs` existe déjà à la racine.)
- `src/ai/errors.ts` — type `AIError`, codes, factory `aiError`.
- `src/ai/types.ts` — types de domaine + type `AIProvider`.
- `src/ai/command-runner.ts` — type `CommandRunner` + `createExecaRunner`.
- `src/ai/schemas.ts` — schémas Zod + JSON Schema générés.
- `src/ai/claude-cli-provider.ts` — `createClaudeCliProvider`.
- `src/ai/index.ts` — fabrique `createAIProvider` + ré-exports.
- `tests/**` — tests unitaires miroir.

> **Périmètre des méthodes :** `cookingAssistant` (chemin texte), `generatePlan` (chemin structuré), `transcribeRecipePhoto` (stub Phase 2). `extractRecipe`/`generateRecipe` viendront avec leurs specs de modèle de données.

---

### Task 1: Scaffold (TypeScript + Vitest + ESLint FP)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Test: `tests/smoke.test.ts`
- (Existe déjà : `eslint.config.mjs`.)

**Interfaces:**
- Consumes: rien.
- Produces: projet où `pnpm test` exécute Vitest et `pnpm lint` exécute ESLint avec les règles FP.

- [ ] **Step 1: Écrire `package.json`**

```json
{
  "name": "la-cambuse",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/js": "^9.13.0",
    "@types/node": "^22.0.0",
    "eslint": "^9.13.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-functional": "^7.1.0",
    "prettier": "^3.3.0",
    "typescript": "^5.6.0",
    "typescript-eslint": "^8.10.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "execa": "^9.5.0",
    "neverthrow": "^8.1.0",
    "zod": "^4.0.0"
  }
}
```

- [ ] **Step 2: Écrire `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "tests", "*.config.mjs", "eslint.config.mjs"]
}
```

- [ ] **Step 3: Écrire `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Écrire le test smoke `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("exécute Vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Installer les dépendances**

Run: `pnpm install`
Expected: installation sans erreur.

- [ ] **Step 6: Lancer test et lint**

Run: `pnpm test && pnpm lint`
Expected: test PASS (1) ; lint sans erreur (aucun fichier `src/` encore).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tests/smoke.test.ts
git commit -m "chore: scaffold TypeScript + Vitest + ESLint FP"
```

---

### Task 2: Erreurs (AIError + aiError)

**Files:**
- Create: `src/ai/errors.ts`
- Test: `tests/ai/errors.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `type AIErrorCode = "process_failed" | "invalid_output" | "schema_validation_failed" | "unsupported"`.
  - `interface AIError { readonly code: AIErrorCode; readonly message: string; readonly cause?: unknown }`.
  - `const aiError = (code: AIErrorCode, message: string, cause?: unknown): AIError`.

- [ ] **Step 1: Écrire le test `tests/ai/errors.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { aiError } from "../../src/ai/errors.js";

describe("aiError", () => {
  it("construit un AIError étiqueté", () => {
    const cause = { raw: 1 };
    const err = aiError("invalid_output", "sortie cassée", cause);
    expect(err).toEqual({
      code: "invalid_output",
      message: "sortie cassée",
      cause,
    });
  });

  it("omet cause quand non fournie", () => {
    expect(aiError("unsupported", "non dispo")).toEqual({
      code: "unsupported",
      message: "non dispo",
    });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `pnpm exec vitest run tests/ai/errors.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/errors.js'`.

- [ ] **Step 3: Écrire `src/ai/errors.ts`**

```ts
export type AIErrorCode =
  | "process_failed"
  | "invalid_output"
  | "schema_validation_failed"
  | "unsupported";

export interface AIError {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export const aiError = (
  code: AIErrorCode,
  message: string,
  cause?: unknown,
): AIError => (cause === undefined ? { code, message } : { code, message, cause });
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `pnpm exec vitest run tests/ai/errors.test.ts`
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add src/ai/errors.ts tests/ai/errors.test.ts
git commit -m "feat(ai): type AIError et factory aiError"
```

---

### Task 3: CommandRunner + createExecaRunner

**Files:**
- Create: `src/ai/command-runner.ts`
- Test: `tests/ai/command-runner.test.ts`

**Interfaces:**
- Consumes: `aiError`, `AIError` (Task 2) ; `execa` ; `neverthrow`.
- Produces:
  - `interface CommandResult { readonly stdout: string; readonly exitCode: number }`.
  - `type CommandRunner = (args: readonly string[], stdin: string) => ResultAsync<CommandResult, AIError>`.
  - `const createExecaRunner = (command?: string): CommandRunner` (défaut `"claude"`).

- [ ] **Step 1: Écrire le test `tests/ai/command-runner.test.ts`**

Le test pointe le runner vers `node` (au lieu de `claude`) pour vérifier la plomberie sans dépendre de Claude.

```ts
import { describe, it, expect } from "vitest";
import { createExecaRunner } from "../../src/ai/command-runner.js";

const ECHO_STDIN =
  'let d="";process.stdin.on("data",c=>d+=c);' +
  'process.stdin.on("end",()=>process.stdout.write(JSON.stringify({result:d})))';

describe("createExecaRunner", () => {
  it("transmet stdin et capture stdout", async () => {
    const run = createExecaRunner(process.execPath);
    const result = await run(["-e", ECHO_STDIN], "bonjour");
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.exitCode).toBe(0);
    expect(JSON.parse(value.stdout)).toEqual({ result: "bonjour" });
  });

  it("remonte un code de sortie non nul sans erreur", async () => {
    const run = createExecaRunner(process.execPath);
    const result = await run(["-e", "process.exit(3)"], "");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().exitCode).toBe(3);
  });

  it("renvoie une erreur si la commande est introuvable", async () => {
    const run = createExecaRunner("commande-inexistante-xyz");
    const result = await run([], "");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("process_failed");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `pnpm exec vitest run tests/ai/command-runner.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/command-runner.js'`.

- [ ] **Step 3: Écrire `src/ai/command-runner.ts`**

```ts
import { execa } from "execa";
import { ResultAsync } from "neverthrow";
import type { AIError } from "./errors.js";
import { aiError } from "./errors.js";

export interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number;
}

export type CommandRunner = (
  args: readonly string[],
  stdin: string,
) => ResultAsync<CommandResult, AIError>;

export const createExecaRunner =
  (command = "claude"): CommandRunner =>
  (args, stdin) =>
    ResultAsync.fromPromise(
      execa(command, [...args], {
        input: stdin,
        reject: false,
        stripFinalNewline: false,
      }),
      (cause) => aiError("process_failed", "Échec du lancement du CLI.", cause),
    ).map((r) => ({ stdout: r.stdout, exitCode: r.exitCode ?? 0 }));
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `pnpm exec vitest run tests/ai/command-runner.test.ts`
Expected: PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/ai/command-runner.ts tests/ai/command-runner.test.ts
git commit -m "feat(ai): CommandRunner fonctionnel + createExecaRunner"
```

---

### Task 4: Provider — chemin texte (cookingAssistant) et stub vision

**Files:**
- Create: `src/ai/types.ts`
- Create: `src/ai/claude-cli-provider.ts`
- Test: `tests/ai/cooking-assistant.test.ts`

**Interfaces:**
- Consumes: `AIError`/`aiError` (Task 2) ; `CommandRunner`/`CommandResult` (Task 3) ; `neverthrow`.
- Produces:
  - `src/ai/types.ts` : `CookingContext`, et le type `AIProvider` avec `cookingAssistant` + `transcribeRecipePhoto` (la méthode `generatePlan` est ajoutée en Task 5).
  - `src/ai/claude-cli-provider.ts` : `createClaudeCliProvider(runner: CommandRunner): AIProvider` ; helpers internes purs `buildBaseArgs(systemPrompt, model)` et `parseEnvelope(stdout, exitCode)` (réutilisés en Task 5) ; `type Model = "sonnet" | "opus"`.

- [ ] **Step 1: Écrire `src/ai/types.ts`**

```ts
import type { ResultAsync } from "neverthrow";
import type { AIError } from "./errors.js";

export interface CookingContext {
  readonly recipeTitle: string;
  readonly currentStep?: number;
  readonly familyProfile: string;
}

export interface AIProvider {
  readonly cookingAssistant: (
    question: string,
    context: CookingContext,
  ) => ResultAsync<string, AIError>;
  readonly transcribeRecipePhoto: (
    imagePath: string,
  ) => ResultAsync<never, AIError>;
}
```

- [ ] **Step 2: Écrire le test `tests/ai/cooking-assistant.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { okAsync } from "neverthrow";
import { createClaudeCliProvider } from "../../src/ai/claude-cli-provider.js";
import type { CommandResult, CommandRunner } from "../../src/ai/command-runner.js";

const makeFakeRunner = (result: CommandResult) => {
  let lastArgs: readonly string[] = [];
  let lastStdin = "";
  const run: CommandRunner = (args, stdin) => {
    lastArgs = args;
    lastStdin = stdin;
    return okAsync(result);
  };
  return { run, getArgs: () => lastArgs, getStdin: () => lastStdin };
};

const ctx = { recipeTitle: "Quiche", familyProfile: "2 adultes, 1 enfant" };

describe("cookingAssistant", () => {
  it("retourne le texte de la réponse", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: "Utilise du yaourt." }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.cookingAssistant("Pas de crème ?", ctx);
    expect(res.isOk()).toBe(true);
    expect(res._unsafeUnwrap()).toBe("Utilise du yaourt.");
  });

  it("passe les bons arguments CLI et le prompt en stdin", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: "ok" }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    await provider.cookingAssistant("question", ctx);
    expect(fake.getArgs()).toEqual(
      expect.arrayContaining([
        "-p",
        "--output-format",
        "json",
        "--model",
        "sonnet",
        "--tools",
        "",
        "--setting-sources",
        "",
        "--system-prompt",
      ]),
    );
    expect(fake.getArgs()).not.toContain("--json-schema");
    expect(fake.getStdin()).toContain("question");
  });

  it("renvoie process_failed sur code non nul", async () => {
    const fake = makeFakeRunner({ stdout: "", exitCode: 1 });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.cookingAssistant("q", ctx);
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("process_failed");
  });

  it("renvoie invalid_output sur sortie non-JSON", async () => {
    const fake = makeFakeRunner({ stdout: "pas du json", exitCode: 0 });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.cookingAssistant("q", ctx);
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("invalid_output");
  });
});

describe("transcribeRecipePhoto", () => {
  it("renvoie unsupported (non disponible en mode CLI)", async () => {
    const fake = makeFakeRunner({ stdout: "", exitCode: 0 });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.transcribeRecipePhoto("photo.png");
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("unsupported");
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier l'échec**

Run: `pnpm exec vitest run tests/ai/cooking-assistant.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/claude-cli-provider.js'`.

- [ ] **Step 4: Écrire `src/ai/claude-cli-provider.ts`**

```ts
import { errAsync, ok, err, Result } from "neverthrow";
import type { AIError } from "./errors.js";
import { aiError } from "./errors.js";
import type { CommandRunner } from "./command-runner.js";
import type { AIProvider, CookingContext } from "./types.js";

export type Model = "sonnet" | "opus";

interface ClaudeEnvelope {
  readonly result?: unknown;
  readonly is_error?: boolean;
}

const buildBaseArgs = (systemPrompt: string, model: Model): readonly string[] => [
  "-p",
  "--output-format",
  "json",
  "--model",
  model,
  "--system-prompt",
  systemPrompt,
  "--tools",
  "",
  "--setting-sources",
  "",
];

const parseJson = Result.fromThrowable(
  (text: string): unknown => JSON.parse(text),
  (cause): AIError => aiError("invalid_output", "Sortie non-JSON.", cause),
);

const parseEnvelope = (
  stdout: string,
  exitCode: number,
): Result<string, AIError> =>
  exitCode !== 0
    ? err(aiError("process_failed", `Le CLI Claude a terminé avec le code ${exitCode}.`))
    : parseJson(stdout).andThen((value) => {
        const envelope = value as ClaudeEnvelope;
        return envelope.is_error === true || typeof envelope.result !== "string"
          ? err<string, AIError>(
              aiError("invalid_output", "Réponse IA invalide ou en erreur."),
            )
          : ok<string, AIError>(envelope.result);
      });

const buildCookingPrompt = (question: string, context: CookingContext): string =>
  [
    `Profil famille:\n${context.familyProfile}`,
    `Recette en cours: ${context.recipeTitle}`,
    context.currentStep !== undefined ? `Étape actuelle: ${context.currentStep}` : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

export const createClaudeCliProvider = (runner: CommandRunner): AIProvider => ({
  cookingAssistant: (question, context) => {
    const systemPrompt =
      "Tu es l'assistant cuisine de l'application. Réponds de façon concise et directe.";
    const args = buildBaseArgs(systemPrompt, "sonnet");
    return runner(args, buildCookingPrompt(question, context)).andThen((r) =>
      parseEnvelope(r.stdout, r.exitCode),
    );
  },

  transcribeRecipePhoto: () =>
    errAsync(
      aiError(
        "unsupported",
        "La transcription photo n'est pas disponible en mode CLI (Phase 2 / mode API).",
      ),
    ),
});

export { buildBaseArgs, parseEnvelope, parseJson };
```

- [ ] **Step 5: Lancer le test et le lint**

Run: `pnpm exec vitest run tests/ai/cooking-assistant.test.ts && pnpm lint`
Expected: tests PASS (5) ; lint sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/ai/types.ts src/ai/claude-cli-provider.ts tests/ai/cooking-assistant.test.ts
git commit -m "feat(ai): createClaudeCliProvider (cookingAssistant + stub vision)"
```

---

### Task 5: Sortie structurée — schémas et generatePlan

**Files:**
- Modify: `src/ai/types.ts` (ajouter types de planning + `generatePlan` à `AIProvider`)
- Create: `src/ai/schemas.ts`
- Modify: `src/ai/claude-cli-provider.ts` (ajouter `runStructured` + `generatePlan`)
- Test: `tests/ai/generate-plan.test.ts`

**Interfaces:**
- Consumes: helpers `buildBaseArgs`, `parseEnvelope`, `parseJson` (Task 4) ; `zod`.
- Produces:
  - Types `PlanGenerationInput`, `PlanMeal`, `PlanDay`, `WeekPlan` (readonly) dans `types.ts`.
  - `generatePlan: (input: PlanGenerationInput) => ResultAsync<WeekPlan, AIError>` ajouté à `AIProvider`.
  - `weekPlanSchema` (Zod) et `weekPlanJsonSchema` (string) dans `schemas.ts`.

- [ ] **Step 1: Écrire le test `tests/ai/generate-plan.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { okAsync } from "neverthrow";
import { createClaudeCliProvider } from "../../src/ai/claude-cli-provider.js";
import type { CommandResult, CommandRunner } from "../../src/ai/command-runner.js";

const makeFakeRunner = (result: CommandResult) => {
  let lastArgs: readonly string[] = [];
  const run: CommandRunner = (args) => {
    lastArgs = args;
    return okAsync(result);
  };
  return { run, getArgs: () => lastArgs };
};

const input = { familyProfile: "2 adultes", days: 2, mealsPerDay: ["dîner"] };

const validPlan = {
  days: [
    { dayLabel: "Lundi", meals: [{ slot: "dîner", recipeTitle: "Soupe" }] },
  ],
};

describe("generatePlan", () => {
  it("retourne un planning validé", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify(validPlan) }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isOk()).toBe(true);
    expect(res._unsafeUnwrap()).toEqual(validPlan);
  });

  it("ajoute --json-schema et utilise le modèle opus", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify(validPlan) }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    await provider.generatePlan(input);
    expect(fake.getArgs()).toContain("--json-schema");
    expect(fake.getArgs()).toContain("opus");
  });

  it("renvoie invalid_output si la sortie structurée n'est pas du JSON", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: "{cassé" }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("invalid_output");
  });

  it("renvoie schema_validation_failed si la sortie ne respecte pas le schéma", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify({ wrong: true }) }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("schema_validation_failed");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `pnpm exec vitest run tests/ai/generate-plan.test.ts`
Expected: FAIL — `provider.generatePlan is not a function` (ou erreur de compilation TS).

- [ ] **Step 3: Ajouter les types de planning dans `src/ai/types.ts`**

Ajouter ces types :

```ts
export interface PlanGenerationInput {
  readonly familyProfile: string;
  readonly constraints?: string;
  readonly days: number;
  readonly mealsPerDay: readonly string[];
}

export interface PlanMeal {
  readonly slot: string;
  readonly recipeTitle: string;
}

export interface PlanDay {
  readonly dayLabel: string;
  readonly meals: readonly PlanMeal[];
}

export interface WeekPlan {
  readonly days: readonly PlanDay[];
}
```

Et remplacer l'interface `AIProvider` par :

```ts
export interface AIProvider {
  readonly generatePlan: (
    input: PlanGenerationInput,
  ) => ResultAsync<WeekPlan, AIError>;
  readonly cookingAssistant: (
    question: string,
    context: CookingContext,
  ) => ResultAsync<string, AIError>;
  readonly transcribeRecipePhoto: (
    imagePath: string,
  ) => ResultAsync<never, AIError>;
}
```

- [ ] **Step 4: Écrire `src/ai/schemas.ts`**

```ts
import { z } from "zod";

export const weekPlanSchema = z.object({
  days: z.array(
    z.object({
      dayLabel: z.string(),
      meals: z.array(
        z.object({
          slot: z.string(),
          recipeTitle: z.string(),
        }),
      ),
    }),
  ),
});

export const weekPlanJsonSchema = JSON.stringify(z.toJSONSchema(weekPlanSchema));
```

- [ ] **Step 5: Ajouter `runStructured` et `generatePlan` dans `src/ai/claude-cli-provider.ts`**

Ajouter les imports en tête de fichier :

```ts
import type { z } from "zod";
import type {
  AIProvider,
  CookingContext,
  PlanGenerationInput,
  WeekPlan,
} from "./types.js";
import { weekPlanJsonSchema, weekPlanSchema } from "./schemas.js";
```

Ajouter ce helper pur au niveau module (après `parseEnvelope`) :

```ts
const buildPlanPrompt = (input: PlanGenerationInput): string =>
  [
    `Profil famille:\n${input.familyProfile}`,
    input.constraints ? `Contraintes:\n${input.constraints}` : "",
    `Nombre de jours: ${input.days}`,
    `Repas par jour: ${input.mealsPerDay.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
```

Ajouter `generatePlan` dans l'objet renvoyé par `createClaudeCliProvider` :

```ts
  generatePlan: (input) => {
    const systemPrompt =
      "Tu es le moteur de planification de repas. Réponds UNIQUEMENT avec un planning conforme au schéma JSON fourni.";
    const args = [
      ...buildBaseArgs(systemPrompt, "opus"),
      "--json-schema",
      weekPlanJsonSchema,
    ];
    return runner(args, buildPlanPrompt(input))
      .andThen((r) => parseEnvelope(r.stdout, r.exitCode))
      .andThen((text) => parseJson(text))
      .andThen((parsed) => validateWith(weekPlanSchema, parsed));
  },
```

Ajouter le helper de validation Zod → `Result` au niveau module :

```ts
const validateWith = <T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, AIError> => {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? ok<T, AIError>(parsed.data)
    : err<T, AIError>(
        aiError(
          "schema_validation_failed",
          "La sortie IA ne respecte pas le schéma attendu.",
          parsed.error,
        ),
      );
};
```

> Note : `WeekPlan` (interface readonly) et `z.infer<typeof weekPlanSchema>` sont structurellement compatibles → `generatePlan` typé `ResultAsync<WeekPlan, AIError>` accepte le `Result` issu de `validateWith(weekPlanSchema, …)`.

- [ ] **Step 6: Lancer les tests, le lint et le typage**

Run: `pnpm exec vitest run tests/ai/generate-plan.test.ts tests/ai/cooking-assistant.test.ts && pnpm lint && pnpm typecheck`
Expected: tests PASS ; lint OK ; aucune erreur de type.

- [ ] **Step 7: Commit**

```bash
git add src/ai/types.ts src/ai/schemas.ts src/ai/claude-cli-provider.ts tests/ai/generate-plan.test.ts
git commit -m "feat(ai): sortie structurée + generatePlan (Result + schéma Zod)"
```

---

### Task 6: Fabrique createAIProvider

**Files:**
- Create: `src/ai/index.ts`
- Test: `tests/ai/factory.test.ts`

**Interfaces:**
- Consumes: `AIProvider` (Task 5) ; `aiError`/`AIError` (Task 2) ; `createClaudeCliProvider` (Task 4) ; `createExecaRunner` (Task 3) ; `neverthrow`.
- Produces: `createAIProvider(env?: NodeJS.ProcessEnv): Result<AIProvider, AIError>` — `cli` (défaut) → `ok(provider)` ; `api` → `err(unsupported)` ; valeur inconnue → `err(unsupported)`. Ré-exporte les types et factories publics.

- [ ] **Step 1: Écrire le test `tests/ai/factory.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createAIProvider } from "../../src/ai/index.js";

describe("createAIProvider", () => {
  it("renvoie un provider par défaut (cli)", () => {
    const res = createAIProvider({});
    expect(res.isOk()).toBe(true);
    expect(typeof res._unsafeUnwrap().generatePlan).toBe("function");
  });

  it("renvoie un provider quand AI_PROVIDER=cli", () => {
    expect(createAIProvider({ AI_PROVIDER: "cli" }).isOk()).toBe(true);
  });

  it("renvoie unsupported quand AI_PROVIDER=api", () => {
    const res = createAIProvider({ AI_PROVIDER: "api" });
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("unsupported");
  });

  it("renvoie unsupported sur une valeur inconnue", () => {
    const res = createAIProvider({ AI_PROVIDER: "xxx" });
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("unsupported");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `pnpm exec vitest run tests/ai/factory.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/index.js'`.

- [ ] **Step 3: Écrire `src/ai/index.ts`**

```ts
import { ok, err, type Result } from "neverthrow";
import type { AIError } from "./errors.js";
import { aiError } from "./errors.js";
import type { AIProvider } from "./types.js";
import { createClaudeCliProvider } from "./claude-cli-provider.js";
import { createExecaRunner } from "./command-runner.js";

export type { AIError, AIErrorCode } from "./errors.js";
export { aiError } from "./errors.js";
export type {
  AIProvider,
  CookingContext,
  PlanGenerationInput,
  PlanDay,
  PlanMeal,
  WeekPlan,
} from "./types.js";
export type { CommandRunner, CommandResult } from "./command-runner.js";
export { createClaudeCliProvider } from "./claude-cli-provider.js";
export { createExecaRunner } from "./command-runner.js";

export const createAIProvider = (
  env: NodeJS.ProcessEnv = process.env,
): Result<AIProvider, AIError> => {
  const kind = env.AI_PROVIDER ?? "cli";
  return kind === "cli"
    ? ok(createClaudeCliProvider(createExecaRunner()))
    : kind === "api"
      ? err(
          aiError(
            "unsupported",
            "Le provider API (AnthropicApiProvider) n'est pas encore implémenté.",
          ),
        )
      : err(aiError("unsupported", `AI_PROVIDER inconnu: ${kind}`));
};
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `pnpm exec vitest run tests/ai/factory.test.ts`
Expected: PASS (4).

- [ ] **Step 5: Suite complète + lint + typage**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: tous les tests PASS ; lint OK ; aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git add src/ai/index.ts tests/ai/factory.test.ts
git commit -m "feat(ai): fabrique createAIProvider (Result, sélection par AI_PROVIDER)"
```

---

## Self-Review

**1. Couverture du spec :**
- Couche d'abstraction `AIProvider` (spec §3) → Tasks 4, 5 (type), Task 6 (fabrique). ✓
- Provider CLI via runner + flags + stdin (spec §4) → Tasks 3, 4. ✓
- Flags obligatoires + prompt en stdin (spec §4) → Task 4 `buildBaseArgs` + tests. ✓
- Sortie structurée `--json-schema` + validation (spec §4) → Task 5. ✓
- Auth abonnement sans `--bare` (spec §4) → `createExecaRunner` n'ajoute jamais `--bare` (Task 3) ; contrainte globale. ✓
- Modèles par méthode (spec §5) → Task 4 (`sonnet`), Task 5 (`opus`). ✓
- Vision Phase 2 = erreur `unsupported` (spec §6) → Task 4 + test. ✓
- Gestion d'erreurs sans exception (spec §4, §8 ; FP strict) → `AIError`/`Result` partout (Task 2) + tests d'erreur (Tasks 3, 4, 5, 6). ✓
- Sélection par variable d'environnement (spec §3) → Task 6. ✓
- `AnthropicApiProvider` hors périmètre (spec §9) → fabrique renvoie `unsupported`. ✓
- Filtre allergènes hors couche IA (spec §8) → aucune logique allergènes dans le provider. ✓
- FP strict + linter (CLAUDE.md) → zéro classe, `Result`, immutabilité ; `pnpm lint` exécuté Tasks 4, 5, 6. ✓

**2. Placeholders :** aucun « TBD/TODO » ; chaque step montre du code complet ; schémas Zod réels (minimaux, à enrichir avec la spec du modèle de données planning).

**3. Cohérence des types :** `aiError(code, message, cause?)` identique partout ; `CommandRunner = (args, stdin) => ResultAsync<CommandResult, AIError>` identique entre Task 3 (définition), Tasks 4/5 (usage) et les `makeFakeRunner` de test ; `Model` exporté Task 4, réutilisé Task 5 ; helpers `buildBaseArgs`/`parseEnvelope`/`parseJson` exportés Task 4 et consommés Task 5 ; `WeekPlan` (readonly) structurellement compatible avec `z.infer<typeof weekPlanSchema>` (Task 5).

---

## Execution Handoff

Plan terminé et sauvegardé dans `docs/superpowers/plans/2026-06-22-ai-provider-layer.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un subagent neuf par tâche, revue entre les tâches.
2. **Inline Execution** — exécution dans cette session via executing-plans, par lots avec points de contrôle.

Laquelle préfères-tu ?
