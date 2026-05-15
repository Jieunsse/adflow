# src/ — Feature-Sliced Design (Light)

이 디렉터리는 ADR-001 (`docs/adr/ADR-001-fsd-adoption.md`) 결정에 따른 **FSD Light variant** 코드 베이스예요. 도메인 어휘는 `docs/CONTEXT.md` 참조.

## 레이어 (위 → 아래, 상위가 하위를 import)

| 레이어 | 용도 | 예 |
|---|---|---|
| `widgets/` | 페이지 규모 composite | `widgets/launch-step/`, `widgets/creative-step/`, `widgets/performance-step/` |
| `features/` | 사용자 행동 단위 (verb) | `features/generate-copy/`, `features/launch-campaign/`, `features/set-kpi-target/` |
| `entities/` | 도메인 객체 (noun) | `entities/campaign/`, `entities/creative/`, `entities/insights/` |
| `shared/` | 도메인 무관 유틸 | `shared/ui/`, `shared/lib/`, `shared/api/` |

### FSD 의 `app` · `pages` 레이어는 안 씁니다
이유: Next.js 16 이 라우팅 디렉터리(`app/` · `pages/`) 를 자동 감지하기 때문에 `src/app/` 또는 `src/pages/` 가 존재하면 *"라우터 두 개 섞었네"* 오류로 dev 서버가 안 떠요.

- **FSD `app` 레이어 역할(providers · query client · theme init)** → Next.js 의 `app/providers.tsx` · `app/layout.tsx` 가 그대로 담당. 별도 `src/app/` 안 만듦.
- **FSD `pages` 레이어 역할(widget 묶기)** → Next.js 의 `app/<route>/page.tsx` 가 widget 을 직접 import 해서 렌더. 별도 `src/pages/` 안 만듦.

## 규칙 (lint 강제 X — 컨벤션으로만)

1. **하위 레이어만 import 가능** — `widgets` 는 `features`·`entities`·`shared` import OK. `features` 는 `entities`·`shared` 만. `entities` 는 `shared` 만.
2. **같은 레이어의 다른 slice 직접 import 금지** — `features/A` 가 `features/B` 를 import 하지 말 것. 공통 로직은 `entities` 또는 `shared` 로 끌어내림.
3. **Slice 내부 segment(`ui/model/api/lib/config`) 강제 X** — 단일 파일도 OK, 폴더로 잘게 쪼개도 OK. 슬라이스 한 개 = 한 폴더 (또는 한 파일).

## Next.js `app/` 책임

Next.js App Router 의 `app/<route>/page.tsx` 는 **라우트 진입점 + FSD app 레이어 역할** 을 겸함 — providers / layout / 라우트 진입 + widget 호출. 도메인 로직·UI 는 `src/` 안에 있어야.

## 경로 별칭

`tsconfig.json` `paths` 에 매핑됨:
- `@widgets/*` → `src/widgets/*`
- `@features/*` → `src/features/*`
- `@entities/*` → `src/entities/*`
- `@shared/*` → `src/shared/*`

(`@app` · `@pages` 별칭은 없음 — 위 § "FSD app · pages 레이어는 안 씁니다" 참조)

## 마이그레이션 상태 (2026-05-13)

신규 feature 는 본 디렉터리로 작성. 기존 `app/(workspace)/*`, `app/_components/*`, `app/_hooks/*`, `lib/*` 는 widget 단위로 점차 이동. 종착점·시퀀스는 ADR-001 §"후속 결정" 참조.
