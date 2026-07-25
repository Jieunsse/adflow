import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  { ignores: [".next/**", "node_modules/**"] },
  {
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
