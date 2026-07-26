# AdFlow

Meta(Facebook·Instagram) 광고를 기획부터 게재·성과 회고까지 한 흐름으로 굴리는 마케팅 워크스페이스예요.
**Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 3**.

## 시작하기

모노레포예요 — `apps/web`(Next.js) + `apps/api`(Spring Boot) + `packages/contracts`.

**둘러보기만 볼 거라면** 프론트만 띄우면 돼요.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # NEXTAUTH_SECRET 등 필수값 채우기
npm run dev                                    # http://localhost:3000
```

**저장 기능(실 유저 경로)까지 쓰려면** 백엔드가 필요해요. 시크릿 3종을 먼저 만들어요.

```bash
python3 -c "import secrets;print('ADFLOW_JWT_SECRET=' + secrets.token_urlsafe(48))"
python3 -c "import secrets;print('ADFLOW_INTERNAL_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets,base64;print('ADFLOW_ENCRYPTION_KEY=' + base64.urlsafe_b64encode(secrets.token_bytes(24)).decode()[:32])"
```

출력 3줄을 `apps/web/.env.local` 에 붙이고 `ADFLOW_BACKEND_URL=http://localhost:8080` 도 더해요.
`ADFLOW_ENCRYPTION_KEY` 는 **정확히 32자** 여야 해요 (`echo -n "<값>" | wc -c` 로 확인).
**이 키를 잃으면 저장된 Meta·Notion 토큰을 복구할 수 없어요** — 재로그인으로 다시 받아야 해요.

그다음 셋을 순서대로 띄워요. Spring 은 같은 값을 셸 환경변수로 받아요.

```bash
docker compose up -d postgres
```

```bash
cd apps/api && ADFLOW_JWT_SECRET='<값>' ADFLOW_INTERNAL_SECRET='<값>' ADFLOW_ENCRYPTION_KEY='<32자>' ./gradlew bootRun --args='--spring.profiles.active=local'
```

```bash
npm run dev
```

`local` 프로필은 폴러 주기를 1분으로 줄여요(운영 기본 6시간). 한 사이클을 바로 돌리려면
`POST /internal/poller/run` 에 `X-Internal-Secret` 헤더를 실어 보내요.

포트 3000 이 사용 중이면 `npm run dev` 가 3001·3002… 로 옮겨 띄우고 `NEXTAUTH_URL` 도 같이 맞춰요.
그때 **Facebook 로그인만 안 돼요** — Meta 콘솔에 등록한 redirect_uri 가 3000 이라서요. 둘러보기와
저장 기능은 그대로 돼요. Facebook OAuth 를 검증할 땐 3000 을 비우고 `npm run https-dev` 를 쓰세요.

Meta 앱 자격증명은 `.env.local` 대신 `/install` 마법사로 넣는 게 기본이에요 (로컬 암호화 파일에 저장).
자격증명이 없으면 `middleware.ts` 가 `/install` 로 보내요. 로그인 없이 훑어보려면 `둘러보기` 모드를 쓰세요.

## npm scripts

| 명령 | 용도 |
|------|------|
| `npm run dev` | 개발 서버 (Turbopack) — 빈 포트를 골라 `NEXTAUTH_URL` 을 맞춰요 |
| `npm run https-dev` | HTTPS 개발 서버 — Meta OAuth 콜백 검증용 (포트 3000 고정) |
| `npm run build` | 프로덕션 빌드 |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm test` | Vitest (회귀 안전망) |
| `npm run contracts:generate` | OpenAPI 스냅샷 + TS 타입 재생성 (**Spring 이 떠 있어야 해요**) |

백엔드는 `apps/api` 에서 `./gradlew test`(H2, Docker 불필요) · `./gradlew integrationTest`(Testcontainers
Postgres) · `./gradlew bootRun`. 계약이 어긋나면 `./gradlew test` 가 깨져요 — `OpenApiSnapshotTest` 가
커밋된 `packages/contracts/openapi.json` 을 현재 컨트롤러와 비교해요.

네 커맨드(`tsc` · `vitest` · `eslint` · `gradlew test`)는 [CI](./.github/workflows/ci.yml) 에서도 돌아요.

lint 는 기존 위반 80건을 `apps/web/eslint-suppressions.json` 에 **기준선**으로 박아두고 켰어요.
그래서 깨지면 새로 생긴 위반이에요. 밀린 것을 갚으려면 그 파일에서 항목을 지우고 고치면 되고,
`npx eslint . --prune-suppressions` 로 이미 사라진 항목을 정리할 수 있어요.

## 환경변수

`.env.example` 에 전부 주석과 함께 정리돼 있어요. `.env.local` 은 `.gitignore` 로 막혀 있어요 (커밋 금지).

필수는 `NEXTAUTH_URL` · `NEXTAUTH_SECRET` 둘. 나머지(Meta·Gemini·Notion)는 쓰는 기능만 채우면 돼요.

영속은 Spring 백엔드(`apps/api`)가 맡아요. 저장 기능을 쓰려면 `ADFLOW_BACKEND_URL` 과 시크릿 3종이 필요해요.

## 문서

- [AGENTS.md](./AGENTS.md) — AI 에이전트·기여자 행동 규칙 (디자인 토큰·UX 라이팅·커밋 형식). **작업 전 필독.**
- **`.document/` 는 git 에 없어요** — 로컬 전용 문서예요(1인 개발). 클론에는 안 따라와요.
- [.document/CONTEXT.md](./.document/CONTEXT.md) — 도메인 어휘 단일 소스
- [.document/adr/](./.document/adr/) — 아키텍처 결정 기록
- [.document/prd/](./.document/prd/) — 기능별 PRD
- [apps/api](./apps/api) — Spring 백엔드. 스키마는 JPA 엔티티가 단일 소스예요 (`ddl-auto`, 로컬 전용)
