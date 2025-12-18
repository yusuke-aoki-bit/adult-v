import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
      "**/*.js",
    ],
  },
  {
    rules: {
      // Changed from "off" to "warn" for gradual improvement
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-require-imports": "off",
      // beforeInteractive is needed for Google Consent Mode to work properly
      "@next/next/no-before-interactive-script-outside-document": "off",
      // External images from multiple CDNs require <img> tag
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
