# AdFlow

Meta(Facebook·Instagram) 광고를 기획부터 게재·성과 회고까지 한 흐름으로 굴리는 Next.js 워크스페이스예요.

## 시작하기

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # NEXTAUTH_SECRET 등 필수값 채우기
pnpm dev                                    # http://localhost:3000
```

둘러보기 모드는 별도 저장소 없이 프론트의 localStorage만 사용해요.

실사용 저장 기능은 Spring 백엔드(`apps/api`)와 로컬 Postgres 가 필요해요.

```bash
docker compose up -d postgres
```

```bash
cd apps/api && ADFLOW_JWT_SECRET='<값>' ADFLOW_INTERNAL_SECRET='<값>' ADFLOW_ENCRYPTION_KEY='<32자>' ./gradlew bootRun --args='--spring.profiles.active=local'
```

```bash
pnpm dev
```

`local` 프로필은 폴러 주기를 1분으로 줄여요(운영 기본 6시간). 한 사이클을 바로 돌리려면
`POST /internal/poller/run` 에 `X-Internal-Secret` 헤더를 실어 보내요.

포트 3000 이 사용 중이면 `pnpm dev` 가 3001·3002… 로 옮겨 띄우고 `NEXTAUTH_URL` 도 같이 맞춰요.
그때 **Facebook 로그인만 안 돼요** — Meta 콘솔에 등록한 redirect_uri 가 3000 이라서요. 둘러보기와
저장 기능은 그대로 돼요. Facebook OAuth 를 검증할 땐 3000 을 비우고 `pnpm https-dev` 를 쓰세요.

Meta 앱 자격증명은 `.env.local` 대신 `/install` 마법사로 넣는 게 기본이에요 (로컬 암호화 파일에 저장).
자격증명이 없으면 `middleware.ts` 가 `/install` 로 보내요. 로그인 없이 훑어보려면 `둘러보기` 모드를 쓰세요.

## 스크립트

| 명령 | 용도 |
|------|------|
| `pnpm dev` | 개발 서버 (Turbopack) — 빈 포트를 골라 `NEXTAUTH_URL` 을 맞춰요 |
| `pnpm https-dev` | HTTPS 개발 서버 — Meta OAuth 콜백 검증용 (포트 3000 고정) |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm lint` | ESLint (next/core-web-vitals + typescript) |
| `pnpm test` | Vitest (회귀 안전망) |
| `pnpm test:e2e` | Playwright (화면 흐름) |
| `pnpm contracts:generate` | OpenAPI 스냅샷 + TS 타입 재생성 (**Spring 이 떠 있어야 해요**) |

백엔드는 `apps/api` 에서 `./gradlew test`(H2, Docker 불필요) · `./gradlew integrationTest`(Testcontainers
Postgres) · `./gradlew bootRun`. 계약이 어긋나면 `./gradlew test` 가 깨져요 — `OpenApiSnapshotTest` 가
커밋된 `packages/contracts/openapi.json` 을 현재 컨트롤러와 비교해요.

네 커맨드(`tsc` · `vitest` · `eslint` · `gradlew test`)는 [CI](./.github/workflows/ci.yml) 에서도 돌아요.

lint 는 기존 위반 80건을 `apps/web/eslint-suppressions.json` 에 **기준선**으로 박아두고 켰어요.
그래서 깨지면 새로 생긴 위반이에요. 밀린 것을 갚으려면 그 파일에서 항목을 지우고 고치면 되고,
`pnpm exec eslint . --prune-suppressions` 로 이미 사라진 항목을 정리할 수 있어요.

## 환경변수

`.env.example` 에 전부 주석과 함께 정리돼 있어요. `.env.local` 은 `.gitignore` 로 막혀 있어요 (커밋 금지).

필수는 `NEXTAUTH_URL` · `NEXTAUTH_SECRET` 둘. 나머지(Meta·Gemini·Notion)는 쓰는 기능만 채우면 돼요.

영속은 Spring 백엔드(`apps/api`)가 맡아요. 저장 기능을 쓰려면 `ADFLOW_BACKEND_URL` 과 시크릿 3종이 필요해요.

## 문서

- [AGENTS.md](./AGENTS.md) — AI 에이전트·기여자 규칙
- [.document/CONTEXT.md](./.document/CONTEXT.md) — 도메인 어휘
- [.document/adr/](./.document/adr/) — 아키텍처 결정 기록
