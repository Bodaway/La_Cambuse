import { z } from "zod";
import type { AIProvider } from "../ai/types.js";
import type { AIErrorCode } from "../ai/errors.js";

export interface AiApiResponse {
  readonly status: number;
  readonly body: unknown;
}

const requestSchema = z.object({
  kind: z.literal("generatePlan"),
  input: z.object({
    familyProfile: z.string(),
    constraints: z.string().optional(),
    days: z.number(),
    mealsPerDay: z.array(z.string()),
  }),
});

const statusForError = (code: AIErrorCode): number =>
  code === "unsupported" ? 501 : 502;

export const createAiApiHandler =
  (provider: AIProvider) =>
  async (rawRequest: unknown): Promise<AiApiResponse> => {
    const parsed = requestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      return {
        status: 400,
        body: { error: { code: "bad_request", message: "Requête invalide." } },
      };
    }
    const result = await provider.generatePlan(parsed.data.input);
    return result.match(
      (data): AiApiResponse => ({ status: 200, body: { data } }),
      (error): AiApiResponse => ({
        status: statusForError(error.code),
        body: { error: { code: error.code, message: error.message } },
      }),
    );
  };
