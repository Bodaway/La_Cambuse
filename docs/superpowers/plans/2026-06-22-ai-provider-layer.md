# Couche AIProvider (routage IA via CLI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la couche d'accès IA du backend : une interface `AIProvider` consommée par tout le code métier, et une implémentation `ClaudeCliProvider` qui route les appels vers le CLI Claude Code en développement, avec bascule API ultérieure par simple variable d'environnement.

**Architecture:** Le code métier ne parle qu'à l'interface `AIProvider`. `ClaudeCliProvider` lance le CLI via une abstraction `CommandRunner` injectable (vraie implémentation `execa`, fausse en test) ; il construit les arguments (`-p --output-format json --system-prompt … --tools "" --setting-sources ""`, plus `--json-schema` pour les sorties structurées), passe le prompt métier en stdin, parse l'enveloppe JSON et valide la sortie structurée avec Zod. Une fabrique `createAIProvider(env)` choisit l'implémentation selon `AI_PROVIDER`.

**Tech Stack:** TypeScript (ESM, NodeNext), Node 22+, Vitest (tests), Zod v4 (validation + génération de JSON Schema via `z.toJSONSchema`), execa v9 (exécution de process cross-platform, gère `claude.cmd` sous Windows).

## Global Constraints

- **Dev local uniquement** : `ClaudeCliProvider` utilise l'abonnement du développeur ; interdit en déploiement (CGU). La bascule API se fera par une implémentation séparée `AnthropicApiProvider`, hors périmètre de ce plan.
- **Le code métier ne dépend que de l'interface `AIProvider`** — jamais du CLI ni de l'API directement.
- **Aucune responsabilité de sécurité allergènes dans cette couche** : le filtre allergènes déterministe (SQL) s'applique en aval, hors provider.
- **Ne jamais utiliser `--bare`** (force `ANTHROPIC_API_KEY` et ignore l'OAuth de l'abonnement).
- **Arguments CLI obligatoires sur tout appel** : `-p`, `--output-format json`, `--system-prompt <…>`, `--tools ""`, `--setting-sources ""`, `--model <alias>`. Le prompt métier passe par **stdin**, pas en argument positionnel.
- **Modèles par méthode** : `generatePlan` → `opus` ; `cookingAssistant` → `sonnet`.
- **Vision (transcription photo)** : non disponible en mode CLI (Phase 2) — la méthode existe mais lève une erreur.
- **Plateforme de dev : Windows** — d'où `execa` plutôt que `child_process.spawn` brut.

---

## File Structure

- `package.json`, `tsconfig.json`, `vitest.config.ts` — scaffold du projet.
- `src/ai/types.ts` — `AIProviderError`, types de domaine, interface `AIProvider`.
- `src/ai/command-runner.ts` — interface `CommandRunner` + `ExecaCommandRunner`.
- `src/ai/schemas.ts` — schémas Zod et JSON Schema générés.
- `src/ai/claude-cli-provider.ts` — `ClaudeCliProvider`.
- `src/ai/index.ts` — fabrique `createAIProvider`.
- `tests/**` — tests unitaires miroir.

> **Périmètre des méthodes :** ce plan implémente `cookingAssistant` (chemin texte), `generatePlan` (chemin structuré) et `transcribeRecipePhoto` (stub Phase 2). `extractRecipe` et `generateRecipe` viendront avec leurs specs de modèle de données respectives — ils ne sont pas dans l'interface tant qu'ils ne sont pas implémentés (règle : aucune méthode déclarée sans tâche).

---

### Task 1: Scaffold du projet

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: un projet où `npm test` exécute Vitest.

- [ ] **Step 1: Écrire `package.json`**

```json
{
  "name": "la-cambuse",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "execa": "^9.5.0",
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
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "tests"]
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

Run: `npm install`
Expected: installation sans erreur, `node_modules/` créé.

- [ ] **Step 6: Lancer le test**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tests/smoke.test.ts
git commit -m "chore: scaffold projet TypeScript + Vitest"
```

---

### Task 2: Types, erreur et interface de base

**Files:**
- Create: `src/ai/types.ts`
- Test: `tests/ai/error.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `class AIProviderError extends Error` avec `code: AIProviderErrorCode` et support de `{ cause }`.
  - `type AIProviderErrorCode = "process_failed" | "invalid_output" | "schema_validation_failed" | "unsupported"`.
  - `interface CookingContext { recipeTitle: string; currentStep?: number; familyProfile: string }`.
  - `interface AIProvider { cookingAssistant(question: string, context: CookingContext): Promise<string>; transcribeRecipePhoto(imagePath: string): Promise<never>; }`.

- [ ] **Step 1: Écrire le test `tests/ai/error.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { AIProviderError } from "../../src/ai/types.js";

describe("AIProviderError", () => {
  it("porte un code, un message et une cause", () => {
    const cause = new Error("racine");
    const err = new AIProviderError("invalid_output", "sortie cassée", { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AIProviderError");
    expect(err.code).toBe("invalid_output");
    expect(err.message).toBe("sortie cassée");
    expect(err.cause).toBe(cause);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/ai/error.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/types.js'`.

- [ ] **Step 3: Écrire `src/ai/types.ts`**

```ts
export type AIProviderErrorCode =
  | "process_failed"
  | "invalid_output"
  | "schema_validation_failed"
  | "unsupported";

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;

  constructor(
    code: AIProviderErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AIProviderError";
    this.code = code;
  }
}

export interface CookingContext {
  recipeTitle: string;
  currentStep?: number;
  familyProfile: string;
}

export interface AIProvider {
  cookingAssistant(question: string, context: CookingContext): Promise<string>;
  transcribeRecipePhoto(imagePath: string): Promise<never>;
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/ai/error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ai/types.ts tests/ai/error.test.ts
git commit -m "feat(ai): AIProviderError, types de domaine et interface AIProvider"
```

---

### Task 3: CommandRunner et ExecaCommandRunner

**Files:**
- Create: `src/ai/command-runner.ts`
- Test: `tests/ai/command-runner.test.ts`

**Interfaces:**
- Consumes: `execa`.
- Produces:
  - `interface CommandResult { stdout: string; exitCode: number }`.
  - `interface CommandRunner { run(args: string[], stdin: string): Promise<CommandResult> }`.
  - `class ExecaCommandRunner implements CommandRunner` ; constructeur `(command: string = "claude")` ; exécute `command` avec `args`, `stdin` injecté, sans rejeter sur code non nul.

- [ ] **Step 1: Écrire le test `tests/ai/command-runner.test.ts`**

Le test pointe le runner vers `node` (au lieu de `claude`) pour vérifier le plomberie stdin/stdout/exitCode sans dépendre de Claude.

```ts
import { describe, it, expect } from "vitest";
import { ExecaCommandRunner } from "../../src/ai/command-runner.js";

const ECHO_STDIN =
  'let d="";process.stdin.on("data",c=>d+=c);' +
  'process.stdin.on("end",()=>process.stdout.write(JSON.stringify({result:d})))';

describe("ExecaCommandRunner", () => {
  it("transmet stdin et capture stdout", async () => {
    const runner = new ExecaCommandRunner(process.execPath);
    const { stdout, exitCode } = await runner.run(["-e", ECHO_STDIN], "bonjour");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ result: "bonjour" });
  });

  it("remonte un code de sortie non nul", async () => {
    const runner = new ExecaCommandRunner(process.execPath);
    const { exitCode } = await runner.run(["-e", "process.exit(3)"], "");
    expect(exitCode).toBe(3);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/ai/command-runner.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/command-runner.js'`.

- [ ] **Step 3: Écrire `src/ai/command-runner.ts`**

```ts
import { execa } from "execa";

export interface CommandResult {
  stdout: string;
  exitCode: number;
}

export interface CommandRunner {
  run(args: string[], stdin: string): Promise<CommandResult>;
}

export class ExecaCommandRunner implements CommandRunner {
  constructor(private readonly command: string = "claude") {}

  async run(args: string[], stdin: string): Promise<CommandResult> {
    const result = await execa(this.command, args, {
      input: stdin,
      reject: false,
      stripFinalNewline: false,
    });
    return { stdout: result.stdout, exitCode: result.exitCode ?? 0 };
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/ai/command-runner.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/command-runner.ts tests/ai/command-runner.test.ts
git commit -m "feat(ai): CommandRunner + ExecaCommandRunner"
```

---

### Task 4: ClaudeCliProvider — chemin texte et stub vision

**Files:**
- Create: `src/ai/claude-cli-provider.ts`
- Test: `tests/ai/claude-cli-provider.test.ts`

**Interfaces:**
- Consumes: `AIProvider`, `CookingContext`, `AIProviderError` (Task 2) ; `CommandRunner` (Task 3).
- Produces:
  - `class ClaudeCliProvider implements AIProvider` ; constructeur `(runner: CommandRunner)`.
  - Méthodes privées `buildBaseArgs(systemPrompt, model)`, `parseEnvelope(stdout, exitCode)`, `runText({ systemPrompt, userPrompt, model })` réutilisées par la Task 5.
  - `type Model = "sonnet" | "opus"` (exporté pour réutilisation interne).

- [ ] **Step 1: Écrire le test `tests/ai/claude-cli-provider.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ClaudeCliProvider } from "../../src/ai/claude-cli-provider.js";
import { AIProviderError } from "../../src/ai/types.js";
import type { CommandResult, CommandRunner } from "../../src/ai/command-runner.js";

class FakeRunner implements CommandRunner {
  lastArgs: string[] = [];
  lastStdin = "";
  constructor(private readonly result: CommandResult) {}
  async run(args: string[], stdin: string): Promise<CommandResult> {
    this.lastArgs = args;
    this.lastStdin = stdin;
    return this.result;
  }
}

const ctx = { recipeTitle: "Quiche", familyProfile: "2 adultes, 1 enfant" };

describe("ClaudeCliProvider.cookingAssistant", () => {
  it("retourne le texte de la réponse", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: "Utilise du yaourt." }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    const answer = await provider.cookingAssistant("Pas de crème ?", ctx);
    expect(answer).toBe("Utilise du yaourt.");
  });

  it("passe les bons arguments CLI et le prompt en stdin", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: "ok" }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    await provider.cookingAssistant("question", ctx);
    expect(runner.lastArgs).toEqual(
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
    expect(runner.lastArgs).not.toContain("--json-schema");
    expect(runner.lastStdin).toContain("question");
  });

  it("lève AIProviderError sur code de sortie non nul", async () => {
    const runner = new FakeRunner({ stdout: "", exitCode: 1 });
    const provider = new ClaudeCliProvider(runner);
    await expect(provider.cookingAssistant("q", ctx)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });

  it("lève AIProviderError sur sortie non-JSON", async () => {
    const runner = new FakeRunner({ stdout: "pas du json", exitCode: 0 });
    const provider = new ClaudeCliProvider(runner);
    await expect(provider.cookingAssistant("q", ctx)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });
});

describe("ClaudeCliProvider.transcribeRecipePhoto", () => {
  it("lève AIProviderError (non disponible en mode CLI)", async () => {
    const runner = new FakeRunner({ stdout: "", exitCode: 0 });
    const provider = new ClaudeCliProvider(runner);
    await expect(
      provider.transcribeRecipePhoto("photo.png"),
    ).rejects.toBeInstanceOf(AIProviderError);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/ai/claude-cli-provider.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/claude-cli-provider.js'`.

- [ ] **Step 3: Écrire `src/ai/claude-cli-provider.ts`**

```ts
import type { AIProvider, CookingContext } from "./types.js";
import { AIProviderError } from "./types.js";
import type { CommandRunner } from "./command-runner.js";

export type Model = "sonnet" | "opus";

interface ClaudeEnvelope {
  result?: unknown;
  is_error?: boolean;
}

export class ClaudeCliProvider implements AIProvider {
  constructor(private readonly runner: CommandRunner) {}

  async cookingAssistant(
    question: string,
    context: CookingContext,
  ): Promise<string> {
    const systemPrompt =
      "Tu es l'assistant cuisine de l'application. Réponds de façon concise et directe.";
    const userPrompt = [
      `Profil famille:\n${context.familyProfile}`,
      `Recette en cours: ${context.recipeTitle}`,
      context.currentStep !== undefined
        ? `Étape actuelle: ${context.currentStep}`
        : "",
      `Question: ${question}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    return this.runText({ systemPrompt, userPrompt, model: "sonnet" });
  }

  async transcribeRecipePhoto(_imagePath: string): Promise<never> {
    throw new AIProviderError(
      "unsupported",
      "La transcription photo n'est pas disponible en mode CLI (prévue en Phase 2 / mode API).",
    );
  }

  protected buildBaseArgs(systemPrompt: string, model: Model): string[] {
    return [
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
  }

  protected parseEnvelope(stdout: string, exitCode: number): string {
    if (exitCode !== 0) {
      throw new AIProviderError(
        "process_failed",
        `Le CLI Claude a terminé avec le code ${exitCode}.`,
      );
    }
    let envelope: ClaudeEnvelope;
    try {
      envelope = JSON.parse(stdout) as ClaudeEnvelope;
    } catch (cause) {
      throw new AIProviderError("invalid_output", "Sortie CLI non-JSON.", {
        cause,
      });
    }
    if (envelope.is_error === true || typeof envelope.result !== "string") {
      throw new AIProviderError(
        "invalid_output",
        "Réponse IA invalide ou en erreur.",
      );
    }
    return envelope.result;
  }

  protected async runText(params: {
    systemPrompt: string;
    userPrompt: string;
    model: Model;
  }): Promise<string> {
    const args = this.buildBaseArgs(params.systemPrompt, params.model);
    const { stdout, exitCode } = await this.runner.run(args, params.userPrompt);
    return this.parseEnvelope(stdout, exitCode);
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/ai/claude-cli-provider.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/claude-cli-provider.ts tests/ai/claude-cli-provider.test.ts
git commit -m "feat(ai): ClaudeCliProvider (chemin texte + stub vision)"
```

---

### Task 5: Sortie structurée — schémas et generatePlan

**Files:**
- Modify: `src/ai/types.ts` (ajouter types de planning + méthode `generatePlan` à l'interface)
- Create: `src/ai/schemas.ts`
- Modify: `src/ai/claude-cli-provider.ts` (ajouter `runStructured` + `generatePlan`)
- Test: `tests/ai/generate-plan.test.ts`

**Interfaces:**
- Consumes: `ClaudeCliProvider` (Task 4) ; `zod`.
- Produces:
  - Types `PlanGenerationInput`, `PlanMeal`, `PlanDay`, `WeekPlan` dans `types.ts`.
  - `generatePlan(input: PlanGenerationInput): Promise<WeekPlan>` ajouté à l'interface `AIProvider`.
  - `weekPlanSchema` (Zod) et `weekPlanJsonSchema` (string) dans `schemas.ts`.
  - Méthode privée `runStructured<T>` dans `ClaudeCliProvider`.

- [ ] **Step 1: Écrire le test `tests/ai/generate-plan.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ClaudeCliProvider } from "../../src/ai/claude-cli-provider.js";
import { AIProviderError } from "../../src/ai/types.js";
import type { CommandResult, CommandRunner } from "../../src/ai/command-runner.js";

class FakeRunner implements CommandRunner {
  lastArgs: string[] = [];
  constructor(private readonly result: CommandResult) {}
  async run(args: string[]): Promise<CommandResult> {
    this.lastArgs = args;
    return this.result;
  }
}

const input = {
  familyProfile: "2 adultes",
  days: 2,
  mealsPerDay: ["dîner"],
};

const validPlan = {
  days: [
    { dayLabel: "Lundi", meals: [{ slot: "dîner", recipeTitle: "Soupe" }] },
  ],
};

describe("ClaudeCliProvider.generatePlan", () => {
  it("retourne un planning validé", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify(validPlan) }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    const plan = await provider.generatePlan(input);
    expect(plan).toEqual(validPlan);
  });

  it("ajoute --json-schema et utilise le modèle opus", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify(validPlan) }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    await provider.generatePlan(input);
    expect(runner.lastArgs).toContain("--json-schema");
    expect(runner.lastArgs).toContain("opus");
  });

  it("lève AIProviderError si la sortie structurée n'est pas du JSON", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: "{cassé" }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    await expect(provider.generatePlan(input)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });

  it("lève AIProviderError si la sortie ne respecte pas le schéma", async () => {
    const runner = new FakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify({ wrong: true }) }),
      exitCode: 0,
    });
    const provider = new ClaudeCliProvider(runner);
    await expect(provider.generatePlan(input)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/ai/generate-plan.test.ts`
Expected: FAIL — `provider.generatePlan is not a function` (ou erreur de type/compilation).

- [ ] **Step 3: Ajouter les types de planning dans `src/ai/types.ts`**

Ajouter ces types et la méthode `generatePlan` à l'interface `AIProvider` :

```ts
export interface PlanGenerationInput {
  familyProfile: string;
  constraints?: string;
  days: number;
  mealsPerDay: string[];
}

export interface PlanMeal {
  slot: string;
  recipeTitle: string;
}

export interface PlanDay {
  dayLabel: string;
  meals: PlanMeal[];
}

export interface WeekPlan {
  days: PlanDay[];
}
```

Et modifier l'interface `AIProvider` pour qu'elle devienne :

```ts
export interface AIProvider {
  generatePlan(input: PlanGenerationInput): Promise<WeekPlan>;
  cookingAssistant(question: string, context: CookingContext): Promise<string>;
  transcribeRecipePhoto(imagePath: string): Promise<never>;
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
import type { PlanGenerationInput, WeekPlan } from "./types.js";
import type { z } from "zod";
import { weekPlanJsonSchema, weekPlanSchema } from "./schemas.js";
```

Ajouter ces deux méthodes dans la classe `ClaudeCliProvider` :

```ts
  async generatePlan(input: PlanGenerationInput): Promise<WeekPlan> {
    const systemPrompt =
      "Tu es le moteur de planification de repas. Réponds UNIQUEMENT avec un planning conforme au schéma JSON fourni.";
    const userPrompt = [
      `Profil famille:\n${input.familyProfile}`,
      input.constraints ? `Contraintes:\n${input.constraints}` : "",
      `Nombre de jours: ${input.days}`,
      `Repas par jour: ${input.mealsPerDay.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    return this.runStructured({
      systemPrompt,
      userPrompt,
      model: "opus",
      jsonSchema: weekPlanJsonSchema,
      schema: weekPlanSchema,
    });
  }

  protected async runStructured<T>(params: {
    systemPrompt: string;
    userPrompt: string;
    model: Model;
    jsonSchema: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    const args = [
      ...this.buildBaseArgs(params.systemPrompt, params.model),
      "--json-schema",
      params.jsonSchema,
    ];
    const { stdout, exitCode } = await this.runner.run(args, params.userPrompt);
    const resultText = this.parseEnvelope(stdout, exitCode);
    let parsed: unknown;
    try {
      parsed = JSON.parse(resultText);
    } catch (cause) {
      throw new AIProviderError(
        "invalid_output",
        "La sortie structurée n'est pas du JSON.",
        { cause },
      );
    }
    const validation = params.schema.safeParse(parsed);
    if (!validation.success) {
      throw new AIProviderError(
        "schema_validation_failed",
        "La sortie IA ne respecte pas le schéma attendu.",
        { cause: validation.error },
      );
    }
    return validation.data;
  }
```

- [ ] **Step 6: Lancer les tests pour vérifier le succès**

Run: `npx vitest run tests/ai/generate-plan.test.ts tests/ai/claude-cli-provider.test.ts`
Expected: PASS (tous).

- [ ] **Step 7: Vérifier le typage**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add src/ai/types.ts src/ai/schemas.ts src/ai/claude-cli-provider.ts tests/ai/generate-plan.test.ts
git commit -m "feat(ai): sortie structurée + generatePlan (schéma Zod/JSON)"
```

---

### Task 6: Fabrique createAIProvider

**Files:**
- Create: `src/ai/index.ts`
- Test: `tests/ai/factory.test.ts`

**Interfaces:**
- Consumes: `AIProvider`, `AIProviderError` (Task 2) ; `ClaudeCliProvider` (Task 4) ; `ExecaCommandRunner` (Task 3).
- Produces: `createAIProvider(env?: NodeJS.ProcessEnv): AIProvider` — `cli` (défaut) → `ClaudeCliProvider` ; `api` → lève `AIProviderError("unsupported")` (non encore implémenté) ; valeur inconnue → lève `AIProviderError("unsupported")`.

- [ ] **Step 1: Écrire le test `tests/ai/factory.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { createAIProvider } from "../../src/ai/index.js";
import { ClaudeCliProvider } from "../../src/ai/claude-cli-provider.js";
import { AIProviderError } from "../../src/ai/types.js";

describe("createAIProvider", () => {
  it("retourne ClaudeCliProvider par défaut", () => {
    expect(createAIProvider({})).toBeInstanceOf(ClaudeCliProvider);
  });

  it("retourne ClaudeCliProvider quand AI_PROVIDER=cli", () => {
    expect(createAIProvider({ AI_PROVIDER: "cli" })).toBeInstanceOf(
      ClaudeCliProvider,
    );
  });

  it("lève AIProviderError quand AI_PROVIDER=api (non implémenté)", () => {
    expect(() => createAIProvider({ AI_PROVIDER: "api" })).toThrow(
      AIProviderError,
    );
  });

  it("lève AIProviderError sur une valeur inconnue", () => {
    expect(() => createAIProvider({ AI_PROVIDER: "xxx" })).toThrow(
      AIProviderError,
    );
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run tests/ai/factory.test.ts`
Expected: FAIL — `Cannot find module '../../src/ai/index.js'`.

- [ ] **Step 3: Écrire `src/ai/index.ts`**

```ts
import type { AIProvider } from "./types.js";
import { AIProviderError } from "./types.js";
import { ClaudeCliProvider } from "./claude-cli-provider.js";
import { ExecaCommandRunner } from "./command-runner.js";

export * from "./types.js";
export { ClaudeCliProvider } from "./claude-cli-provider.js";
export { ExecaCommandRunner } from "./command-runner.js";
export type { CommandRunner, CommandResult } from "./command-runner.js";

export function createAIProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProvider {
  const kind = env.AI_PROVIDER ?? "cli";
  if (kind === "cli") {
    return new ClaudeCliProvider(new ExecaCommandRunner());
  }
  if (kind === "api") {
    throw new AIProviderError(
      "unsupported",
      "Le provider API (AnthropicApiProvider) n'est pas encore implémenté.",
    );
  }
  throw new AIProviderError("unsupported", `AI_PROVIDER inconnu: ${kind}`);
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npx vitest run tests/ai/factory.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lancer toute la suite et le typage**

Run: `npm test && npm run typecheck`
Expected: tous les tests PASS, aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git add src/ai/index.ts tests/ai/factory.test.ts
git commit -m "feat(ai): fabrique createAIProvider (sélection par AI_PROVIDER)"
```

---

## Self-Review

**1. Couverture du spec :**
- Couche d'abstraction `AIProvider` (spec §3) → Tasks 2, 5 (interface), Task 6 (fabrique). ✓
- `ClaudeCliProvider` via spawn + flags + stdin (spec §4) → Tasks 3, 4. ✓
- Flags obligatoires `--system-prompt`/`--tools ""`/`--setting-sources ""`/`--output-format json`/`--model` (spec §4) → Task 4 `buildBaseArgs` + tests. ✓
- Sortie structurée `--json-schema` (spec §4) → Task 5. ✓
- Auth abonnement sans `--bare` (spec §4) → garanti par `ExecaCommandRunner` qui n'ajoute jamais `--bare` (Task 3) ; contrainte globale. ✓
- Choix de modèle par méthode (spec §5) → Task 4 (`sonnet`), Task 5 (`opus`). ✓
- Vision Phase 2 = méthode qui lève (spec §6) → Task 4 stub + test. ✓
- Gestion d'erreurs → `AIProviderError` (spec §4, §8) → Task 2 + tests d'erreur dans Tasks 4, 5, 6. ✓
- Sélection par variable d'environnement (spec §3) → Task 6. ✓
- `AnthropicApiProvider` hors périmètre (spec §9) → fabrique lève `unsupported` pour `api`. ✓
- Filtre allergènes hors couche IA (spec §8) → respecté : aucune logique allergènes dans le provider (contrainte globale). ✓

**2. Placeholders :** aucun « TBD/TODO » ; chaque step de code montre du code complet ; les schémas Zod sont réels (minimaux mais fonctionnels, à enrichir avec la spec du modèle de données planning).

**3. Cohérence des types :** `AIProviderError(code, message, {cause})` identique partout ; `CommandRunner.run(args, stdin)` identique entre Task 3 (définition), Task 4/5 (usage) et les `FakeRunner` de test ; `Model` exporté en Task 4 et réutilisé en Task 5 ; `WeekPlan` (interface, Task 5) structurellement identique à `z.infer<typeof weekPlanSchema>` (Task 5) → assignation valide.

---

## Execution Handoff

Plan terminé et sauvegardé dans `docs/superpowers/plans/2026-06-22-ai-provider-layer.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — je dispatche un subagent neuf par tâche, avec revue entre les tâches.
2. **Inline Execution** — j'exécute les tâches dans cette session via executing-plans, par lots avec points de contrôle.

Laquelle préfères-tu ?
