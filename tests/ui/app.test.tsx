// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../../src/ui/App.js";

describe("App", () => {
  it("affiche la navigation principale", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Tableau de bord" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cuisine" })).toBeInTheDocument();
  });

  it("affiche le tableau de bord sur la route racine", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Tableau de bord" }),
    ).toBeInTheDocument();
  });
});
