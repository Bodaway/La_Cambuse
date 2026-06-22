import type { ResultAsync } from "neverthrow";
import type { AIError } from "./errors.js";

export interface CookingContext {
  readonly recipeTitle: string;
  readonly currentStep?: number;
  readonly familyProfile: string;
}

export interface PlanGenerationInput {
  readonly familyProfile: string;
  readonly constraints?: string;
  readonly days: number;
  readonly mealsPerDay: readonly string[];
}

export interface PlanMeal {
  readonly slot: string;
  readonly recipeTitle: string;
}

export interface PlanDay {
  readonly dayLabel: string;
  readonly meals: readonly PlanMeal[];
}

export interface WeekPlan {
  readonly days: readonly PlanDay[];
}

export interface AIProvider {
  readonly generatePlan: (
    input: PlanGenerationInput,
  ) => ResultAsync<WeekPlan, AIError>;
  readonly cookingAssistant: (
    question: string,
    context: CookingContext,
  ) => ResultAsync<string, AIError>;
  readonly transcribeRecipePhoto: (
    imagePath: string,
  ) => ResultAsync<never, AIError>;
}
