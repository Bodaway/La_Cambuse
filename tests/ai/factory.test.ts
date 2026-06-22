import { describe, it, expect } from "vitest";
import { createAIProvider } from "../../src/ai/index.js";

describe("createAIProvider", () => {
  it("renvoie un provider par défaut (cli)", () => {
    const res = createAIProvider({});
    expect(res.isOk()).toBe(true);
    expect(typeof res._unsafeUnwrap().generatePlan).toBe("function");
  });

  it("renvoie un provider quand AI_PROVIDER=cli", () => {
    expect(createAIProvider({ AI_PROVIDER: "cli" }).isOk()).toBe(true);
  });

  it("renvoie unsupported quand AI_PROVIDER=api", () => {
    const res = createAIProvider({ AI_PROVIDER: "api" });
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("unsupported");
  });

  it("renvoie unsupported sur une valeur inconnue", () => {
    const res = createAIProvider({ AI_PROVIDER: "xxx" });
    expect(res.isErr()).toBe(true);
    expect(res._unsafeUnwrapErr().code).toBe("unsupported");
  });
});
