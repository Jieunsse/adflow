# `apps/web` 에이전트 규칙

상세한 근거와 예시는 [프론트엔드 개발 가이드](../../docs/engineering/frontend-guidelines.md)를 따른다.

## 구조

- `app/`: Next.js App Router의 라우트·레이아웃·API Route. 라우팅 조합과 서버 경계를 둔다.
- `src/widgets/`: 여러 기능이나 화면을 조합하는 화면 단위 블록.
- `src/features/`: 사용자의 목적을 완성하는 상호작용·유스케이스.
- `src/entities/`: 도메인 모델, 도메인 규칙, 도메인 API.
- `src/shared/`: 특정 도메인에 종속되지 않는 UI·유틸리티.
- `lib/`: Next.js 서버 인프라와 외부 연동. 비밀값·서버 전용 코드는 이 경계를 지킨다.

의존성은 기본적으로 `app → widgets → features → entities → shared` 방향으로 흐른다. 하위 계층이 상위 계층을 import하지 않게 한다. 단, 기존 코드의 점진적 이행을 위해 새 파일부터 적용한다.

## 구현 규칙

- App Router에서는 Server Component를 기본으로 둔다. 브라우저 상태·이벤트·브라우저 API가 필요한 가장 작은 잎 컴포넌트에만 `"use client"`를 붙인다.
- 서로 의존하지 않는 비동기 작업은 `Promise.all`로 시작하고, 조건에 필요 없는 데이터는 먼저 반환한다. 순차 `await`로 요청 waterfall을 만들지 않는다.
- 큰 라이브러리와 무거운 Client Component는 실제 사용 시점에 동적 import한다. barrel export와 사용하지 않는 전체 모듈 import를 새 코드에서 만들지 않는다.
- 서버에서 가져온 데이터는 Client Component가 사용하는 필드만 props로 넘긴다. 인증·권한·비밀값 검증은 서버 경계에서 한다.
- 상태로부터 다시 계산할 수 있는 값은 `useEffect`와 별도 state로 복제하지 않는다. `useMemo`, `useCallback`, `memo`는 측정되거나 명확한 비용이 있을 때만 쓴다.
- URL로 공유·복원되어야 하는 화면 상태는 가능한 경우 query string과 링크로 표현한다.
- 입력 검증, 접근성, 오류 처리, 데이터 손실 방지 같은 안전장치는 성능 단순화보다 우선한다.
- 화면 문구는 루트 규칙과 `.document/UX-WRITING.md`의 해요체를 따른다. 색·타이포·radius·shadow는 기존 디자인 토큰을 재사용한다.

## 공통 UI 규칙

- `shared/ui`는 도메인 타입을 import하지 않는 UI primitive와 도메인 중립 패턴만 둔다.
- 에러 화면은 `@shared/ui/ErrorState`, 폼 label/hint 묶음은 `@shared/ui/FormField`, 체크박스·토글은 각 공통 컴포넌트를 먼저 검토한다.
- `shared/ui`와 같은 역할의 `ErrorCard`, `EmptyState`, `Field`, `Checkbox`, `Toggle`를 페이지 안에 새로 만들지 않는다. 시각적·행동적 차이가 있으면 feature/widget 전용으로 두고 이름을 도메인에 맞게 짓는다.
- `shared/ui` 컴포넌트는 서버 데이터 fetch, 전역 store, 도메인 mutation을 직접 소유하지 않는다. 상태와 action은 feature/widget이 소유하고 공통 UI에는 필요한 값과 이벤트만 전달한다.
- 공통 컴포넌트의 props가 커지거나 callback이 3개를 넘으면 공통화보다 상태 소유 위치를 먼저 재검토한다.

## 작업 전 체크

1. 같은 로직·컴포넌트·타입이 이미 있는지 `rg`로 찾는다.
2. 변경이 어느 계층의 책임인지 확인하고, 여러 계층에 중복 구현하지 않는다.
3. 데이터 흐름에 순차 요청, 불필요한 Client Component, 과한 props serialization이 없는지 확인한다.
4. 조건 분기나 외부 입력 매핑이 있는 새 모듈은 외부 인터페이스 테스트를 함께 검토한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
