import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// A direct config (no eslint-config-next): its Next.js plugin pulls in an unpatched, vulnerable glob toolchain,
// and `next build` no longer runs lint. The rules that matter here are TypeScript and React Hooks / React Compiler.
export default defineConfig([
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "coverage/**", "contracts/**"]),
  ...tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
]);
