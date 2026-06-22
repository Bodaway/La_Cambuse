import { execa } from "execa";
import { ResultAsync } from "neverthrow";
import type { AIError } from "./errors.js";
import { aiError } from "./errors.js";

export interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number;
}

export type CommandRunner = (
  args: readonly string[],
  stdin: string,
) => ResultAsync<CommandResult, AIError>;

// `reject` reste à sa valeur par défaut (true) : tout échec — impossibilité de
// démarrer le process comme code de sortie non nul — rejette la promesse et est
// converti en AIError. En cas de succès, le code de sortie est donc 0.
export const createExecaRunner =
  (command = "claude"): CommandRunner =>
  (args, stdin) =>
    ResultAsync.fromPromise(
      execa(command, [...args], { input: stdin, stripFinalNewline: false }),
      (cause) => aiError("process_failed", "Échec de l'exécution du CLI.", cause),
    ).map((r): CommandResult => ({ stdout: r.stdout, exitCode: r.exitCode ?? 0 }));
