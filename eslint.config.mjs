// ESLint flat config. Next 16 removed `next lint`, so ESLint is wired up
// directly here; `npm run lint` and the CI check both run `eslint .`.
//
// core-web-vitals extends the base Next config with the perf rules (image,
// script, font handling); the typescript entry adds the TS parser and its
// rule set. Both ship as native flat-config arrays in eslint-config-next 16.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // Prisma's generated client — not ours to lint.
      "src/generated/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    name: "myreads/overrides",
    rules: {
      // The codebase deliberately destructures fields it wants to *drop*
      // (`{ userId: _userId, ...book }` in the export route). Underscore
      // prefix is the established signal for that here.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Downgraded from error, deliberately. Five pre-existing components
      // (theme-picker, shelf-chips, add-book-client, barcode-scanner,
      // import-search) read from the DOM or react to a server-action result
      // inside an effect. They work; the modern replacements
      // (useSyncExternalStore, action-state driven rendering) are real
      // rewrites of live features and belong in their own change, not in
      // the commit that merely turns linting on. Left as warnings so the
      // work stays visible instead of being silenced.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
