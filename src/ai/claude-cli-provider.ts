import { errAsync, ok, err, Result, type ResultAsync } from "neverthrow";
import type { z } from "zod";
import type { AIError, AIErrorCode } from "./errors.js";
import { aiError } from "./errors.js";
import type { CommandRunner } from "./command-runner.js";
import type {
  AIProvider,
  CookingContext,
  PlanGenerationInput,
  WeekPlan,
} from "./types.js";
import { weekPlanSchema } from "./schemas.js";

export type Model = "sonnet" | "opus";

interface ClaudeEnvelope {
  readonly result?: unknown;
  readonly is_error?: boolean;
}

const buildBaseArgs = (
  systemPrompt: string,
  model: Model,
): readonly string[] => [
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

const jsonFencePattern = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

// Le CLI enrobe parfois le JSON dans un bloc Markdown ```json … ``` :
// on en extrait le contenu avant de parser.
const extractJsonText = (raw: string): string => {
  const trimmed = raw.trim();
  const match = jsonFencePattern.exec(trimmed);
  return match?.[1] ?? trimmed;
};

const parseEnvelope = (
  stdout: string,
  exitCode: number,
): Result<string, AIError> =>
  exitCode !== 0
    ? err(
        aiError(
          "process_failed",
          `Le CLI Claude a terminé avec le code ${String(exitCode)}.`,
        ),
      )
    : parseJson(stdout).andThen((value): Result<string, AIError> => {
        const envelope = value as ClaudeEnvelope;
        return envelope.is_error === true || typeof envelope.result !== "string"
          ? err(aiError("invalid_output", "Réponse IA invalide ou en erreur."))
          : ok(envelope.result);
      });

const buildCookingPrompt = (
  question: string,
  context: CookingContext,
): string =>
  [
    `Profil famille:\n${context.familyProfile}`,
    `Recette en cours: ${context.recipeTitle}`,
    context.currentStep !== undefined
      ? `Étape actuelle: ${String(context.currentStep)}`
      : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

const buildPlanPrompt = (input: PlanGenerationInput): string =>
  [
    `Profil famille:\n${input.familyProfile}`,
    input.constraints ? `Contraintes:\n${input.constraints}` : "",
    `Nombre de jours: ${String(input.days)}`,
    `Repas par jour: ${input.mealsPerDay.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

const validateWith = <T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, AIError> => {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? ok(parsed.data)
    : err(
        aiError(
          "schema_validation_failed",
          "La sortie IA ne respecte pas le schéma attendu.",
          parsed.error,
        ),
      );
};

// La sortie du LLM est non déterministe : une forme invalide est probablement
// transitoire, donc on réessaie ; une erreur d'exécution (process_failed) non.
const isRetryableError = (code: AIErrorCode): boolean =>
  code === "invalid_output" || code === "schema_validation_failed";

const withRetry = <T>(
  attempt: () => ResultAsync<T, AIError>,
  retries: number,
): ResultAsync<T, AIError> =>
  attempt().orElse((error) =>
    retries > 0 && isRetryableError(error.code)
      ? withRetry(attempt, retries - 1)
      : errAsync(error),
  );

export const createClaudeCliProvider = (runner: CommandRunner): AIProvider => ({
  generatePlan: (input) => {
    // Le CLI Claude Code n'applique pas --json-schema : on impose la forme
    // exacte dans le prompt, puis on extrait/valide le JSON renvoyé, avec
    // jusqu'à 2 nouvelles tentatives si la forme est non conforme.
    const systemPrompt =
      'Tu es le moteur de planification de repas. Tu réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte ni balise Markdown. Forme EXACTE attendue : {"days":[{"dayLabel":"...","meals":[{"slot":"...","recipeTitle":"..."}]}]}';
    const args = buildBaseArgs(systemPrompt, "opus");
    const attempt = (): ResultAsync<WeekPlan, AIError> =>
      runner(args, buildPlanPrompt(input))
        .andThen((r) => parseEnvelope(r.stdout, r.exitCode))
        .andThen((text) => parseJson(extractJsonText(text)))
        .andThen((parsed) => validateWith(weekPlanSchema, parsed));
    return withRetry(attempt, 2);
  },

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
