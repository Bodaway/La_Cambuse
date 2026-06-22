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
