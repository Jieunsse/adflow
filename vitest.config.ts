import { defineConfig } from "vitest/config";
import path from "node:path";

// tsconfig.json paths 와 1:1 매칭 — `*.test.ts` 가 같은 import alias 를 쓸 수 있도록.
// (a) 회귀 안전망 목적이라 pure fn 만 — jsdom·RTL 없이 default node env.

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@widgets\/(.*)$/, replacement: path.resolve(__dirname, "src/widgets/$1") },
      { find: /^@features\/(.*)$/, replacement: path.resolve(__dirname, "src/features/$1") },
      { find: /^@entities\/(.*)$/, replacement: path.resolve(__dirname, "src/entities/$1") },
      { find: /^@shared\/(.*)$/, replacement: path.resolve(__dirname, "src/shared/$1") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "$1") },
    ],
  },
  test: {
    // co-located *.test.ts — slice locality.
    include: ["src/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
