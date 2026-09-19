import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".worktrees/**",
    ".playwright-cli/**",
    "output/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // DynamoDB document records and Auth.js callback payloads are progressively
      // typed. Keep these visible in lint output without blocking a release on
      // legacy adapter boundaries that TypeScript already validates at build time.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
