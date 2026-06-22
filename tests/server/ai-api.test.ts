import { describe, it, expect } from "vitest";
import { okAsync, errAsync } from "neverthrow";
import { createAiApiHandler } from "../../src/server/ai-api.js";
import { aiError } from "../../src/ai/errors.js";
import type { AIProvider, WeekPlan } from "../../src/ai/types.js";
import type { ResultAsync } from "neverthrow";
import type { AIError } from "../../src/ai/errors.js";

const fakeProvider = (
  plan: ResultAsync<WeekPlan, AIError>,
): AIProvider => ({
  generatePlan: () => plan,
  cookingAssistant: () => okAsync(""),
  transcribeRecipePhoto: () => errAsync(aiError("unsupported", "n/a")),
});

const validRequest = {
  kind: "generatePlan",
  input: { familyProfile: "2 adultes", days: 2, mealsPerDay: ["dîner"] },
};

const samplePlan: WeekPlan = {
  days: [{ dayLabel: "Lundi", meals: [{ slot: "dîner", recipeTitle: "Soupe" }] }],
};

describe("createAiApiHandler", () => {
  it("renvoie 200 et le planning sur succès", async () => {
    const handle = createAiApiHandler(fakeProvider(okAsync(samplePlan)));
    const res = await handle(validRequest);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: samplePlan });
  });

  it("renvoie 400 sur requête invalide", async () => {
    const handle = createAiApiHandler(fakeProvider(okAsync(samplePlan)));
    const res = await handle({ kind: "generatePlan", input: { days: "deux" } });
    expect(res.status).toBe(400);
  });

  it("renvoie 502 sur erreur provider (process_failed)", async () => {
    const handle = createAiApiHandler(
      fakeProvider(errAsync(aiError("process_failed", "boom"))),
    );
    const res = await handle(validRequest);
    expect(res.status).toBe(502);
  });

  it("renvoie 501 sur erreur provider (unsupported)", async () => {
    const handle = createAiApiHandler(
      fakeProvider(errAsync(aiError("unsupported", "n/a"))),
    );
    const res = await handle(validRequest);
    expect(res.status).toBe(501);
  });
});
