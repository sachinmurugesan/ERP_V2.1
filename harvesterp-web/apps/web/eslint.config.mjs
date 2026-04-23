import nextConfig from "eslint-config-next";

// Reuse the @typescript-eslint plugin instance already bundled by eslint-config-next
const tsPlugin = nextConfig[1].plugins["@typescript-eslint"];

/** @type {import('eslint').Linter.Config[]} */
const config = [
  // Ignore test files (eslint-config-next already ignores .next/**, build/**, out/**, next-env.d.ts)
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
  },

  // Next.js rules via native flat config — no FlatCompat needed
  ...nextConfig,

  // Stricter TypeScript rules for src files only
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },

  // Universal rules
  {
    rules: { "prefer-const": "error" },
  },
];

export default config;
