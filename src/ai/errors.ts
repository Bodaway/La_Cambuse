export type AIErrorCode =
  | "process_failed"
  | "invalid_output"
  | "schema_validation_failed"
  | "unsupported";

export interface AIError {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export const aiError = (
  code: AIErrorCode,
  message: string,
  cause?: unknown,
): AIError =>
  cause === undefined ? { code, message } : { code, message, cause };
