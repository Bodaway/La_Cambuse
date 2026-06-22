import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard-page.js";
import { PlanningPage } from "./pages/planning-page.js";
import { RecipesPage } from "./pages/recipes-page.js";
import { ShoppingPage } from "./pages/shopping-page.js";
import { CookingPage } from "./pages/cooking-page.js";

const navItems = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/planning", label: "Planning", end: false },
  { to: "/recettes", label: "Recettes", end: false },
  { to: "/courses", label: "Courses", end: false },
  { to: "/cuisine", label: "Cuisine", end: false },
] as const;

export const App = () => (
  <div className="min-h-screen bg-stone-50 text-stone-900">
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap gap-2 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-lg ${
                isActive ? "bg-stone-900 text-white" : "hover:bg-stone-100"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
    <main className="mx-auto max-w-5xl p-4">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/recettes" element={<RecipesPage />} />
        <Route path="/courses" element={<ShoppingPage />} />
        <Route path="/cuisine" element={<CookingPage />} />
      </Routes>
    </main>
  </div>
);
