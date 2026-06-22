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
