import { z } from "zod";

export const weekPlanSchema = z.object({
  days: z.array(
    z.object({
      dayLabel: z.string(),
      meals: z.array(
        z.object({
          slot: z.string(),
          recipeTitle: z.string(),
        }),
      ),
    }),
  ),
});

export const weekPlanJsonSchema = JSON.stringify(z.toJSONSchema(weekPlanSchema));
