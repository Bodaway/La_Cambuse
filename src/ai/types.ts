import type { ResultAsync } from "neverthrow";
import type { AIError } from "./errors.js";

export interface CookingContext {
  readonly recipeTitle: string;
  readonly currentStep?: number;
  readonly familyProfile: string;
}

export interface AIProvider {
  readonly cookingAssistant: (
    question: string,
    context: CookingContext,
  ) => ResultAsync<string, AIError>;
  readonly transcribeRecipePhoto: (
    imagePath: string,
  ) => ResultAsync<never, AIError>;
}
