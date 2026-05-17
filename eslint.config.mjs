import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Plugin not installed — suppress the missing-plugin error globally
      "react-compiler/react-compiler": "off",
      // Allow _ prefix to opt out of the unused-vars check (parameters + vars)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // Common hydration-guard pattern: useEffect(() => setMounted(true), [])
      // is safe and well-established in Next.js — suppress at config level
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
