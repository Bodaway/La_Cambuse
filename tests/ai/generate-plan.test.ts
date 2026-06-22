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

const makeSequenceRunner = (
  results: readonly CommandResult[],
  fallback: CommandResult,
) => {
  let calls = 0;
  const run: CommandRunner = () => {
    const result = results[calls] ?? fallback;
    calls += 1;
    return okAsync(result);
  };
  return { run, getCalls: () => calls };
};

const badResult: CommandResult = {
  stdout: JSON.stringify({ result: JSON.stringify({ wrong: true }) }),
  exitCode: 0,
};
const okResult: CommandResult = {
  stdout: JSON.stringify({ result: JSON.stringify({ days: [] }) }),
  exitCode: 0,
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

  it("utilise le modèle opus sans s'appuyer sur --json-schema", async () => {
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: JSON.stringify(validPlan) }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    await provider.generatePlan(input);
    expect(fake.getArgs()).toContain("opus");
    expect(fake.getArgs()).not.toContain("--json-schema");
  });

  it("accepte un résultat entouré de balises Markdown ```json", async () => {
    const fenced = "```json\n" + JSON.stringify(validPlan) + "\n```";
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: fenced }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isOk()).toBe(true);
    expect(res._unsafeUnwrap()).toEqual(validPlan);
  });

  it("extrait le JSON même entouré de texte", async () => {
    const wrapped =
      "Voici le planning :\n" + JSON.stringify(validPlan) + "\nBon appétit !";
    const fake = makeFakeRunner({
      stdout: JSON.stringify({ result: wrapped }),
      exitCode: 0,
    });
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isOk()).toBe(true);
    expect(res._unsafeUnwrap()).toEqual(validPlan);
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

  it("réessaie sur sortie non conforme puis réussit", async () => {
    const fake = makeSequenceRunner([badResult, okResult], okResult);
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isOk()).toBe(true);
    expect(fake.getCalls()).toBe(2);
  });

  it("échoue après épuisement des tentatives (4 essais)", async () => {
    const fake = makeSequenceRunner([badResult], badResult);
    const provider = createClaudeCliProvider(fake.run);
    const res = await provider.generatePlan(input);
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("schema_validation_failed");
    expect(fake.getCalls()).toBe(4);
  });
});
