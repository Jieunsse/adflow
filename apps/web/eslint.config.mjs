import js from "@eslint/js";
import globals from "globals";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// 2026-07-26 까지 이 설정은 JS 5개(설정 파일·scripts)만 검사했다 — `app/`·`src/`·`lib/` 의 TS·TSX 는
// 한 번도 lint 를 지나간 적이 없다(ESLint 는 기본적으로 .ts/.tsx 를 대상에 넣지 않는다).
// next 설정을 얹어 525개 파일을 검사 대상으로 되돌린다.
//
// FlatCompat(@eslint/eslintrc)으로 얹으면 "Converting circular structure to JSON" 으로 터진다 —
// eslint-config-next 16 은 flat config 를 직접 내보내므로 그쪽을 쓴다. core-web-vitals 가
// next·next/typescript 를 이미 품고 있고, typescript 가 typescript-eslint recommended 를 더한다
// (create-next-app 기본 조합).
const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // js.configs.recommended 는 전에도 이 JS 파일들만 검사했다(TS 는 대상 밖이었으니).
    // 전역으로 얹으면 의도된 `catch {}` 24곳이 no-empty 로 걸린다 — 범위를 원래대로 둔다.
    files: ["**/*.{js,mjs,cjs}"],
    rules: js.configs.recommended.rules,
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];

export default config;
