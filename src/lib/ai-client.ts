import type { PlanGenerationInput, WeekPlan } from "../ai/types.js";

interface PlanSuccess {
  readonly data: WeekPlan;
}

interface ApiErrorBody {
  readonly error: { readonly code: string; readonly message: string };
}

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === "object" && value !== null && "error" in value;

export const requestPlan = async (
  input: PlanGenerationInput,
): Promise<WeekPlan> => {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "generatePlan", input }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = isApiErrorBody(payload)
      ? payload.error.message
      : "Erreur du service IA.";
    return Promise.reject(new Error(message));
  }
  return (payload as PlanSuccess).data;
};
