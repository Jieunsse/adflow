# shadcn/Radix 도입 — Dialog 파일럿 (V1)

> 2026-06-30 · 브랜치 `feat/shadcn-radix` · 베이스라인 502 green

## 목표

shadcn 방식(동작 = Radix 프리미티브, 스타일 = 우리 소유 코드)을 이 레포에 도입한다.
이번 V1은 **Radix Dialog 하나만** 파일럿으로 들여, 포털 스코프·토큰 치환 패턴을
검증하고 굳힌다. 패턴이 서면 이후 Select·기능 모달들을 같은 방식으로 확장한다(후속).

핵심 원칙: **동작은 shadcn식(Radix), 스타일은 우리 디자인 시스템(`--w-*` 토큰) 유지.**

## 확정된 결정 (brainstorming)

| # | 결정 | 근거 |
|---|------|------|
| 접근 | **A안** — 얇은 Radix 래퍼 자작 + 우리 토큰 | shadcn=Radix+스타일. full shadcn(토큰까지)은 ADR-049 위반. shadcn 공식 파일은 `tailwindcss-animate` 의존을 끌고 와 오히려 더 뜯어야 함 |
| Q1 | **className 재작성** — shadcn `bg-primary` 등 → `bg-[var(--w-*)]` | 토큰 1개 네임스페이스 유지(ADR-049). 기존 21개 컴포넌트와 동일 컨벤션 |
| Q2 | **포털 container = 기존 `.adflow` 셸** | `--w-*` 토큰이 `.adflow` 셀렉터 아래 정의됨([design-system.css:13](../../../app/styles/design-system.css)). 포털을 셸에 중첩시켜 토큰·폰트·focus-visible 상속. `.adflow` className을 새 wrapper에 붙이면 bg/min-height까지 딸려와 불투명 풀스크린 bg가 깔리므로 금지 |
| Q3 | **Dialog 파일럿만** — 프리미티브 + ConfirmModal 마이그레이션 | 가장 짧은 diff로 핵심 리스크(포털 스코프) 먼저 해소. Select·기능 모달은 후속 |
| 테스트 | **(b) tsc + 502 green 회귀 + dev 육안** | 고정 전략 "UI 컴포넌트 테스트 안 함"·표현 컴포넌트라 고유 로직 없음(동작은 Radix가 상위 검증) |

## 아키텍처 (3-레이어)

```
@radix-ui/react-dialog      동작: 포커스 트랩 · ESC · scroll lock · aria-modal  [업스트림 검증됨]
        ↓
src/shared/ui/Dialog.tsx    우리 토큰으로 스타일 입힌 얇은 래퍼  (신규)
        ↓
src/shared/ui/ConfirmModal.tsx   Dialog 프리미티브를 조합한 프리셋  (재작성 — 시각·props·호출부 무변경)
```

## 컴포넌트

### 1. 신규 의존성
`@radix-ui/react-dialog` **단 하나.** 메타 패키지·cva·shadcn CLI·tailwindcss-animate 도입 안 함.

### 2. `src/shared/ui/Dialog.tsx` (신규)

V1 export는 **4개만** (Trigger/Footer/Close 등은 두 번째 모달이 필요로 할 때 추가 — 죽은 유연성 금지):

- `Dialog` = Radix `Root` (controlled: `open` / `onOpenChange`)
- `DialogContent` = `Portal(container=.adflow 셸)` + `Overlay`(토큰 bg + `fadeIn`) + `Content`(토큰 패널 + `popIn`)
  - className은 우리 `var(--w-*)` arbitrary value로 작성
  - 포커스 트랩·ESC·scroll lock·`aria-modal`은 Radix가 무료 제공
- `DialogTitle` / `DialogDescription` = Radix Title/Description (a11y 자동 배선 — labelledby/describedby) + 우리 타이포 토큰

**포털 container 해석:**
```
// ponytail: 단일 셸 가정 — .adflow 첫 매치. 멀티 셸 생기면 trigger 기준 ancestor 탐색으로 승급.
const container = typeof document !== "undefined"
  ? document.querySelector<HTMLElement>(".adflow") ?? undefined
  : undefined;
```
모달은 열릴 때(클라)만 렌더되므로 셸 존재 보장. 못 찾으면 Radix 기본(body) 폴백.

### 3. `src/shared/ui/ConfirmModal.tsx` (재작성)

- **시각 픽셀 동일** — 아이콘 배지·타이틀·desc·푸터 버튼·토큰·라운드·그림자 그대로
- **호출부 무변경** — `{show && <ConfirmModal onClose={…} onConfirm={…} … />}` 패턴 유지.
  내부에서 `<Dialog open onOpenChange={(o) => !o && onClose()}>`로 감싼다(마운트=열림 모델 보존)
- 타이틀 → `DialogTitle`, desc → `DialogDescription`으로 매핑(a11y)
- 백드롭 클릭 닫기 → Radix `onPointerDownOutside`(또는 Overlay 클릭)로 유지
- 애니메이션 → 기존 `fadeIn`/`popIn` 키프레임 재사용(진입만, 현재와 동일 — exit 애니 없음)

**순이득 (현재 ConfirmModal의 버그 해소):**

| | 현재 | 마이그 후 |
|---|---|---|
| ESC 닫기 | ❌ 없음 | ✅ |
| 포커스 트랩 | ❌ 없음 | ✅ |
| scroll lock | ❌ 없음 | ✅ |
| `aria-modal`/labelledby | ❌ 없음 | ✅ |
| 백드롭 클릭 닫기 | ✅ | ✅ 유지 |

## 데이터 흐름

상태 없음. ConfirmModal은 부모가 조건부 마운트하는 controlled 컴포넌트.
`onConfirm`/`onClose` 콜백만 위로 전달. 프리미티브는 순수 표현 + Radix 동작.

## 에러 처리

- 포털 container 못 찾음 → Radix body 폴백 (토큰 미상속 가능성은 단일 셸 가정상 비현실적, 폴백은 안전판)
- SSR — 모달은 `"use client"`, 열릴 때만 렌더되므로 `document` 접근 안전

## 테스트 / 검증 (b안)

컴포넌트 테스트 인프라 신설 안 함. 검증 기준:

- [ ] `tsc` clean
- [ ] `502 green` 유지 (회귀 안전망)
- [ ] ConfirmModal 모든 호출부 시각 동일 (dev 육안)
- [ ] ESC · 포커스 트랩 · 백드롭 클릭 닫기 동작 (dev 육안)
- [ ] 다크모드 포털 토큰 정상 렌더 (dev 육안)

## 범위 밖 (후속)

- Select.tsx → Radix Select 교체
- 기능 모달 4종(SopEdit·BrandProfilePicker·PersonaEdit·PersonaQuickCreate) → Dialog 프리미티브 채택
- Tooltip/Popover/DropdownMenu — 커스텀 구현 없음, 도입 이유 없음(YAGNI)
- SegControl — 단순 토글, Radix 가치 낮음
- ADR 발급 — 패턴 확정 후 별도 (UI 동작=Radix, 스타일=ADR-049 토큰, 포털 스코프 규칙)
