# AdFlow

Meta(Facebook·Instagram) 광고를 기획부터 게재·성과 회고까지 한 흐름으로 굴리는 마케팅 워크스페이스예요.
**Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 3**.

## 시작하기

```bash
npm install
cp .env.example .env.local   # NEXTAUTH_SECRET 등 필수값 채우기
npm run dev                  # http://localhost:3000
```

Meta 앱 자격증명은 `.env.local` 대신 `/install` 마법사로 넣는 게 기본이에요 (로컬 암호화 파일에 저장).
자격증명이 없으면 `middleware.ts` 가 `/install` 로 보내요. 로그인 없이 훑어보려면 `둘러보기` 모드를 쓰세요.

## npm scripts

| 명령 | 용도 |
|------|------|
| `npm run dev` | 개발 서버 (Turbopack) |
| `npm run https-dev` | HTTPS 개발 서버 — Meta OAuth 콜백 검증용 |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint |
| `npm test` | Vitest (회귀 안전망) |

## 환경변수

`.env.example` 에 전부 주석과 함께 정리돼 있어요. `.env.local` 은 `.gitignore` 로 막혀 있어요 (커밋 금지).

필수는 `NEXTAUTH_URL` · `NEXTAUTH_SECRET` 둘. 나머지(Meta·Gemini·Notion)는 쓰는 기능만 채우면 돼요.

영속은 Spring 백엔드(`apps/api`)가 맡아요. 저장 기능을 쓰려면 `ADFLOW_BACKEND_URL` 과 시크릿 3종이 필요해요.

## 문서

- [AGENTS.md](./AGENTS.md) — AI 에이전트·기여자 행동 규칙 (디자인 토큰·UX 라이팅·커밋 형식). **작업 전 필독.**
- [.document/CONTEXT.md](./.document/CONTEXT.md) — 도메인 어휘 단일 소스
- [.document/adr/](./.document/adr/) — 아키텍처 결정 기록
- [.document/prd/](./.document/prd/) — 기능별 PRD
- [apps/api](./apps/api) — Spring 백엔드. 스키마는 JPA 엔티티가 단일 소스예요 (`ddl-auto`, 로컬 전용)
