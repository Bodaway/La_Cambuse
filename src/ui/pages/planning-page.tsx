import { useMutation } from "@tanstack/react-query";
import { requestPlan } from "../../lib/ai-client.js";
import type { PlanGenerationInput } from "../../ai/types.js";

const SAMPLE_INPUT: PlanGenerationInput = {
  familyProfile: "2 adultes, 1 enfant. Végétarien le vendredi.",
  days: 5,
  mealsPerDay: ["dîner"],
};

export const PlanningPage = () => {
  const mutation = useMutation({ mutationFn: () => requestPlan(SAMPLE_INPUT) });

  return (
    <section>
      <h1 className="text-3xl font-bold">Planning</h1>
      <p className="mt-2 text-stone-600">
        Planification des repas de la semaine.
      </p>

      <button
        type="button"
        onClick={() => {
          mutation.mutate();
        }}
        disabled={mutation.isPending}
        className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-lg text-white disabled:opacity-50"
      >
        Générer un planning (démo)
      </button>

      {mutation.isPending && <p className="mt-4">Génération en cours…</p>}

      {mutation.isError && (
        <p role="alert" className="mt-4 text-red-700">
          Erreur : {mutation.error.message}
        </p>
      )}

      {mutation.data && (
        <ul className="mt-4 space-y-2">
          {mutation.data.days.map((day) => (
            <li key={day.dayLabel} className="rounded-lg border border-stone-200 p-3">
              <strong>{day.dayLabel}</strong>
              <ul className="mt-1 text-stone-600">
                {day.meals.map((meal) => (
                  <li key={`${day.dayLabel}-${meal.slot}`}>
                    {meal.slot} — {meal.recipeTitle}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
