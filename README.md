# AdFlow

Meta(Facebook·Instagram) 광고를 기획부터 게재·성과 회고까지 한 흐름으로 굴리는 Next.js 워크스페이스예요.

## 시작하기

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

둘러보기 모드는 별도 저장소 없이 프론트의 localStorage만 사용해요.

실사용 저장 기능은 Supabase가 필요해요.

1. Supabase 프로젝트를 만들어요.
2. SQL Editor에서 [supabase/schema.sql](./supabase/schema.sql)을 실행해요.
3. apps/web/.env.local에 SUPABASE_URL과 server-side 전용 SUPABASE_SERVICE_ROLE_KEY를 넣어요.

SUPABASE_SERVICE_ROLE_KEY는 브라우저 코드나 NEXT_PUBLIC_* 변수에 넣으면 안 돼요.

## 명령

| 명령 | 용도 |
|------|------|
| pnpm dev | 개발 서버 |
| pnpm build | 프로덕션 빌드 |
| pnpm lint | ESLint |
| pnpm test | Vitest |
| pnpm test:e2e | Playwright |

Meta·Instagram·Notion·Gemini 연동에는 .env.example에 적힌 각 서비스 자격증명이 추가로 필요해요.

## 문서

- [AGENTS.md](./AGENTS.md) — AI 에이전트·기여자 규칙
- [.document/CONTEXT.md](./.document/CONTEXT.md) — 도메인 어휘
- [.document/adr/](./.document/adr/) — 아키텍처 결정 기록
