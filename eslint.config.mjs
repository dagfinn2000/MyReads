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

      // Left at its default (error). The five components that tripped it —
      // theme-picker, shelf-chips, add-book-client, barcode-scanner,
      // import-search — have been reworked to read external state properly,
      // close dialogs from the action that succeeded, and derive rather than
      // mirror. Nothing is suppressed here any more.
    },
  },
];

export default config;
