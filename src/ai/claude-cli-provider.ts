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
