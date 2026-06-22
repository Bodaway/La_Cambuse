import { describe, it, expect } from "vitest";
import { createExecaRunner } from "../../src/ai/command-runner.js";

const ECHO_STDIN =
  'let d="";process.stdin.on("data",c=>d+=c);' +
  'process.stdin.on("end",()=>process.stdout.write(JSON.stringify({result:d})))';

describe("createExecaRunner", () => {
  it("transmet stdin et capture stdout (succès, code 0)", async () => {
    const run = createExecaRunner(process.execPath);
    const result = await run(["-e", ECHO_STDIN], "bonjour");
    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.exitCode).toBe(0);
    expect(JSON.parse(value.stdout)).toEqual({ result: "bonjour" });
  });

  it("renvoie process_failed sur code de sortie non nul", async () => {
    const run = createExecaRunner(process.execPath);
    const result = await run(["-e", "process.exit(3)"], "");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("process_failed");
  });

  it("renvoie process_failed si la commande est introuvable", async () => {
    const run = createExecaRunner("commande-inexistante-xyz");
    const result = await run([], "");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("process_failed");
  });
});
