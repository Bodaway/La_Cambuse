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
