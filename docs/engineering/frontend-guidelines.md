# 프론트엔드 개발 가이드

대상: `apps/web`의 Next.js App Router와 React 코드

이 문서는 Vercel Engineering의 [React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)를 이 프로젝트에 맞게 적용한 요약이다. 원문 40개 이상의 규칙을 그대로 복사하지 않고, 현재 구조에서 코드 리뷰와 에이전트 작업에 반복적으로 필요한 기준만 둔다. 우선순위는 waterfall 제거와 번들 축소가 가장 높고, 그 다음 서버 성능·클라이언트 fetch·렌더링 최적화 순서다.

## 1. 구조: Next.js + 얇은 FSD

이 프로젝트의 FSD는 디렉터리 수를 늘리는 규칙이 아니라 변경 범위를 줄이는 경계다.

```text
app/       라우트, 레이아웃, API Route
  ↓
widgets/   화면을 구성하는 큰 블록
  ↓
features/  사용자 목적을 완성하는 기능
  ↓
entities/  도메인 데이터와 규칙
  ↓
shared/    도메인 비종속 UI와 유틸리티
```

- `app`은 URL과 화면 조합을 담당한다. 도메인 로직을 길게 넣지 않는다.
- `widgets`는 여러 feature/entity를 배치하고 연결한다. 한 화면에서만 쓰이는 작은 UI를 억지로 올리지 않는다.
- `features`는 사용자의 행동 단위로 둔다. 예: 브랜드 프로필 편집, 이미지 생성, 캠페인 실행.
- `entities`는 도메인 타입·규칙·API를 둔다. 서로 다른 entity 사이의 조합이 화면 흐름이 되면 feature 또는 widget으로 올린다.
- `shared`는 특정 도메인 이름이나 정책을 알지 않아야 한다. 재사용 가능해 보인다는 이유만으로 일찍 이동하지 않는다.
- `lib`는 기존 프로젝트의 서버 인프라·외부 연동 경계다. UI 계층에서 직접 비밀값이나 서버 전용 SDK를 다루지 않는다.

새 코드의 의존성은 `app → widgets → features → entities → shared`를 따른다. 기존 예외를 한 번에 정리하지 말고, 파일을 만지는 범위에서만 점진적으로 고친다. 한 곳에서만 쓰이는 코드는 그곳에 두는 편이 낫다.

## 2. Vercel React/Next.js 적용 규칙

### 가장 높은 우선순위: 요청 waterfall과 번들

- 독립적인 fetch는 동시에 시작한다.

```tsx
const [profile, campaigns] = await Promise.all([
  getProfile(),
  getCampaigns(),
]);
```

- 먼저 확인할 수 있는 값이 있으면 비싼 비동기 작업보다 먼저 확인한다.
- Client Component는 필요한 잎에만 둔다. 서버 컴포넌트 트리를 통째로 `"use client"`로 만들지 않는다.
- 무거운 편집기·차트·모달은 초기 화면에 꼭 필요하지 않으면 `next/dynamic`을 검토한다.
- 새 코드에서 큰 패키지의 전체 import와 불필요한 barrel export를 피한다. 기존 의존성을 먼저 재사용하고 패키지를 추가하지 않는다.

### 서버 성능과 데이터 경계

- 가능한 데이터 fetch는 Server Component 또는 서버 전용 모듈에서 수행한다.
- Client Component에는 실제로 쓰는 원시값이나 작은 DTO만 전달한다. 서버 객체 전체를 props로 넘기지 않는다.
- 같은 요청에서 중복되는 서버 fetch는 기존 캐시·React/Next.js 캐시 패턴을 확인한 뒤 dedupe한다. 캐시는 인증 사용자·변경 빈도·무효화 방법을 함께 검토한다.
- API Route와 서버 함수는 입력·인증·권한을 신뢰하지 않는다. 경계에서 검증하고, 실패 시 사용자가 다음 행동을 알 수 있는 오류를 반환한다.

### 클라이언트 fetch와 상태

- 서버 데이터, URL 상태, 로컬 UI 상태를 구분한다. 서버 데이터를 effect와 별도 state에 복사하지 않는다.
- URL로 공유하거나 새로고침 후 복원해야 하는 필터·탭·페이지는 query string을 우선 검토한다.
- `useEffect`는 외부 시스템 동기화에 사용한다. 파생값 계산, 이벤트 처리, fetch waterfall의 연결 고리로 사용하지 않는다.
- `useMemo`·`useCallback`·`memo`는 기본값이 아니다. 측정된 재계산 비용이나 안정적인 참조가 실제로 필요할 때만 사용한다.

### 서버 상태와 공유 클라이언트 상태

- API에서 읽는 서버 상태·캐시·refetch는 TanStack Query가 소유한다. Query Key는 도메인 API 모듈의 factory로 만든다.
- mutation은 성공 후 영향을 받는 Query Key를 명시적으로 무효화한다. 공통 `useApiMutation`의 `invalidateKeys` 옵션을 우선 사용한다.
- Query Key에는 데이터 범위를 결정하는 안정적인 workspace/account 식별자를 포함하거나, 인증 주체가 바뀔 때 QueryClient를 비운다. 로그아웃·계정 전환 후 이전 사용자의 캐시를 보여주지 않는다.
- 여러 화면에서 공유되고 localStorage·서버 동기화가 필요한 도메인 데이터만 Zustand `createSyncedStore`를 사용한다. 화면 내부 임시 상태는 `useState`/`useReducer`에 둔다.
- Zustand persist 데이터는 사용자 범위로 분리한다. hydration 실패 시 `401/403`은 캐시를 지우고, 네트워크·일시적 서버 오류만 오프라인 캐시로 유지한다.
- optimistic mutation은 요청 순서를 보장하고, 최종 실패 시 rollback·재시도 또는 사용자가 확인할 수 있는 실패 상태를 제공한다.

## 3. 코드 품질: 가독성·예측 가능성·응집도·결합도

### 가독성

가독성은 한 번에 머릿속에서 유지해야 하는 맥락을 줄이는 일이다.

- 같이 실행되지 않는 코드는 분리한다.
- 구현 상세는 작은 함수나 컴포넌트로 감추되, 한 번만 쓰이는 추상화는 만들지 않는다.
- 서로 다른 종류의 로직이 섞인 함수는 쪼갠다. 예: 입력 정규화, 서버 저장, 화면 상태 변경.
- 복잡한 조건과 매직 넘버에 이름을 붙인다.
- 코드는 위에서 아래로 읽히게 배치한다. 깊은 삼항 연산자와 먼 곳으로 시점이 이동하는 제어 흐름을 피한다.

### 예측 가능성

- 이름만 보고 함수의 부작용과 반환 형태를 예상할 수 있어야 한다.
- 같은 종류의 함수는 성공·실패 반환 타입과 오류 처리 방식을 통일한다.
- 숨은 전역 상태 변경, 암묵적 localStorage 접근, 호출 시점에 따라 달라지는 기본값을 드러낸다.
- `onClick` 같은 이벤트 핸들러에서 데이터 저장·토스트·라우팅을 몰래 연쇄하지 말고, 중요한 흐름은 이름 있는 함수로 드러낸다.

### 응집도

- 함께 수정되는 파일은 같은 feature/entity 디렉터리에 둔다.
- 폼의 입력, 검증, 저장 규칙이 함께 바뀐다면 같은 feature 경계에서 관리한다.
- 공통화는 함께 수정되어야 하는 코드에만 한다. 단순히 비슷해 보이는 UI는 중복을 허용해도 된다.
- 상수·타입·정책은 사용하는 도메인 가까이에 둔다. 여러 도메인이 실제로 공유할 때만 `shared`로 이동한다.

### 결합도

- 컴포넌트와 훅은 한 가지 책임을 가진다.
- props drilling이 실제로 문제일 때만 context나 store를 검토한다. 전역 상태를 기본 해결책으로 쓰지 않는다.
- feature가 특정 widget이나 route를 import하지 않게 한다.
- 변경 영향 범위를 줄이는 것이 목적이지, 모든 중복을 제거하는 것이 목적은 아니다.

## 4. UI 기본선

- 키보드 접근성, 명확한 label, focus 상태, 로딩·빈 상태·오류 상태를 빠뜨리지 않는다.
- 색·타이포·radius·shadow는 `app/styles/design-system.css`의 시맨틱 토큰과 `w-*` 타입 스케일을 사용한다. 새 raw hex/rgba와 off-scale 값을 만들지 않는다.
- 사용자에게 보이는 문구는 해요체로 작성하고, 오류에는 무엇이 안 됐는지와 다음 행동을 함께 쓴다.

### 공통 컴포넌트 관리

`shared/ui`는 UI primitive와 도메인 중립 패턴의 집합이다. 도메인 타입, React Query, Zustand, 서버 mutation을 공통 컴포넌트가 직접 알게 하지 않는다.

- 오류 화면은 `ErrorState`, 폼의 label/hint 묶음은 `FormField`, 체크박스와 토글은 기존 공통 컴포넌트를 먼저 사용한다.
- `ErrorCard`, `Field`, `Checkbox`, `Toggle`처럼 같은 역할의 페이지 내부 컴포넌트를 새로 만들지 않는다.
- `EmptyState`, 카드, 모달은 모양이 비슷하다는 이유만으로 합치지 않는다. 데이터 의미나 상호작용이 다르면 feature/widget 전용 컴포넌트로 남긴다.
- 공통 컴포넌트에 필요한 props만 전달한다. 콜백이 많아지면 props drilling을 숨기지 말고 feature 상태 소유권을 다시 정한다.

## 5. 에이전트가 작업을 끝내기 전 확인할 것

- 기존 helper, 타입, 컴포넌트, 패턴을 검색했는가?
- 새 import가 계층 방향을 거스르지 않는가?
- 독립 요청을 순차 `await`로 만들지 않았는가?
- Client Component 범위와 Client/Server props 크기를 필요한 만큼으로 제한했는가?
- 새 조건 분기·외부 입력 매핑·서버 경계에 최소한의 외부 인터페이스 테스트를 검토했는가?
- 변경 파일만 관련 있는가? 기존 unrelated 변경과 `.env.local`은 건드리지 않았는가?

### 참고

- [Vercel React Best Practices 소개](https://vercel.com/blog/introducing-react-best-practices)
- [Vercel React Best Practices 원문](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md)
- [Next.js App Router 데이터 가져오기](https://nextjs.org/docs/app/building-your-application/data-fetching)
