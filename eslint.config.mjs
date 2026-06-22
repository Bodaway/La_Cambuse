// ESLint flat config (v9) — impose le paradigme fonctionnel strict décrit dans CLAUDE.md.
// Dépendances (dev) à installer :
//   pnpm add -D eslint typescript-eslint eslint-plugin-functional @eslint/js eslint-config-prettier
//
// Le formatage est délégué à Prettier ; eslint-config-prettier désactive les
// règles de style en conflit (lint = correction, Prettier = mise en forme).

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import functional from "eslint-plugin-functional";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    // Fichiers ignorés globalement.
    ignores: ["dist/**", "node_modules/**", "coverage/**", "playwright-report/**"],
  },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    files: ["src/**/*.ts", "tests/**/*.ts", "*.config.{ts,mts,mjs}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { functional },
    rules: {
      // --- Paradigme fonctionnel strict (eslint-plugin-functional) ---
      "functional/no-classes": "error",
      "functional/no-this-expressions": "error",
      "functional/no-let": "error",
      "functional/immutable-data": "error",
      "functional/no-loop-statements": "error",
      "functional/no-throw-statements": [
        "error",
        { allowToRejectPromises: false },
      ],
      "functional/prefer-immutable-types": [
        "warn",
        { enforcement: "ReadonlyShallow" },
      ],
      "functional/prefer-property-signatures": "error",

      // --- Stricteté TypeScript ---
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },

  {
    // Les tests peuvent assouplir l'immutabilité (montage de doublures, accumulateurs).
    files: ["tests/**/*.ts"],
    rules: {
      "functional/no-let": "off",
      "functional/immutable-data": "off",
      "functional/prefer-immutable-types": "off",
    },
  },

  // Doit rester en dernier : neutralise les règles de style en conflit avec Prettier.
  prettier,
);
