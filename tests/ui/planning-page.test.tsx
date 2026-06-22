// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WeekPlan } from "../../src/ai/types.js";

vi.mock("../../src/lib/ai-client.js", () => ({ requestPlan: vi.fn() }));
import { requestPlan } from "../../src/lib/ai-client.js";
import { PlanningPage } from "../../src/ui/pages/planning-page.js";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanningPage />
    </QueryClientProvider>,
  );
};

const samplePlan: WeekPlan = {
  days: [{ dayLabel: "Lundi", meals: [{ slot: "dîner", recipeTitle: "Soupe" }] }],
};

beforeEach(() => {
  vi.mocked(requestPlan).mockReset();
});

describe("PlanningPage", () => {
  it("affiche le planning renvoyé après clic", async () => {
    vi.mocked(requestPlan).mockResolvedValue(samplePlan);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Générer un planning (démo)" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Lundi")).toBeInTheDocument();
    });
    expect(screen.getByText("dîner — Soupe")).toBeInTheDocument();
  });

  it("affiche une erreur si la génération échoue", async () => {
    vi.mocked(requestPlan).mockRejectedValue(new Error("Service indisponible"));
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Générer un planning (démo)" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Service indisponible");
    });
  });
});
