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
