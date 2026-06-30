# Radix Dialog 파일럿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** shadcn 방식(동작=Radix, 스타일=우리 토큰)을 Radix Dialog 하나로 파일럿 도입하고, 기존 ConfirmModal을 시각·호출부 무변경으로 그 위에 얹는다.

**Architecture:** 3-레이어 — `@radix-ui/react-dialog`(동작) → `src/shared/ui/Dialog.tsx`(우리 토큰 입힌 얇은 래퍼) → `ConfirmModal.tsx`(프리미티브 조합 프리셋). 포털은 기존 `.adflow` 셸에 container로 중첩해 토큰·폰트를 상속한다.

**Tech Stack:** Next 16 / React 19 · TypeScript strict · Tailwind 3(arbitrary value 토큰) · `@radix-ui/react-dialog` · `cn`(clsx+tailwind-merge, 기설치)

## Global Constraints

- 스타일은 **우리 `var(--w-*)` 토큰만** 사용(ADR-049 단일 소스). shadcn `--primary`/`--background` 토큰 레이어 도입 금지.
- 새 의존성은 **`@radix-ui/react-dialog` 하나만**. cva·shadcn CLI·tailwindcss-animate 추가 금지.
- 패키지 매니저 = **npm**(tracked 락파일 `package-lock.json`).
- 컴포넌트 테스트 인프라(RTL/jsdom) **신설 금지**. 검증 = `tsc` clean + `502 green` 회귀 + dev 육안.
- 새 한국어 인라인 주석 금지(WHY 비자명 시 1줄 + `ponytail:` 마커만 허용).
- 커밋 메시지 = `type(scope): 한국어 설명`, Co-Authored-By 금지.
- ConfirmModal 시각·props·호출부 **무변경**(픽셀 동일).

---

### Task 1: Dialog 프리미티브 + 의존성

**Files:**
- Modify: `package.json` (deps에 `@radix-ui/react-dialog` 추가 — npm install이 수행)
- Create: `src/shared/ui/Dialog.tsx`

**Interfaces:**
- Consumes: `@shared/lib/cn` → `cn(...inputs: ClassValue[]): string`
- Produces:
  - `Dialog` = `DialogPrimitive.Root` (props: `open?: boolean`, `onOpenChange?: (open: boolean) => void`)
  - `DialogContent: React.ForwardRefExoticComponent<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>` — Portal+Overlay+Content를 우리 토큰으로 감싼 패널. `children`, `className`, `style` 통과
  - `DialogTitle: ...<typeof DialogPrimitive.Title>` — `style`/`className`/`children` 통과(a11y labelledby 자동)
  - `DialogDescription: ...<typeof DialogPrimitive.Description>` — `asChild`/`style`/`className`/`children` 통과(a11y describedby 자동)

- [ ] **Step 1: 의존성 설치**

Run:
```bash
npm install @radix-ui/react-dialog
```
Expected: `package.json` deps에 `@radix-ui/react-dialog` 추가, `package-lock.json` 갱신, 에러 없음.

- [ ] **Step 2: 설치 검증**

Run:
```bash
node -e "require.resolve('@radix-ui/react-dialog'); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Dialog.tsx 작성**

Create `src/shared/ui/Dialog.tsx`:
```tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@shared/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

// ponytail: 단일 셸 가정 — .adflow 첫 매치. 멀티 셸 생기면 trigger 기준 ancestor 탐색으로 승급.
function adflowContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".adflow") ?? undefined;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal container={adflowContainer()}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[rgba(15,17,21,0.45)] dark:bg-[rgba(0,0,0,0.6)] grid place-items-center p-10 animate-[fadeIn_120ms_ease]">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "bg-[var(--w-bg-elevated)] border border-[var(--w-line-alternative)] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.20)] max-w-[90vw] max-h-[90vh] overflow-auto animate-[popIn_140ms_ease] focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Overlay>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
```

> 설계 메모: `DialogTitle`/`DialogDescription`는 Radix를 그대로 re-export(스타일은 소비처가 inline으로). Overlay 안에 Content를 중첩하는 건 기존 ConfirmModal의 "오버레이=중앙정렬 컨테이너, 패널=내부" 레이아웃을 그대로 재현하기 위함이고, Radix의 바깥클릭 닫기는 Content 경계 기준이라 정상 동작.

- [ ] **Step 4: 타입체크**

Run:
```bash
npx tsc --noEmit
```
Expected: 에러 없음(clean).

- [ ] **Step 5: 회귀 테스트**

Run:
```bash
npx vitest run
```
Expected: `502 passed` (Dialog는 아직 미사용이라 무변경).

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/shared/ui/Dialog.tsx
git commit -m "feat(shadcn): Radix Dialog 프리미티브 도입 — 우리 토큰 입힌 얇은 래퍼·포털 container=.adflow 셸(토큰/폰트 상속)·@radix-ui/react-dialog 1개"
```

---

### Task 2: ConfirmModal 마이그레이션

**Files:**
- Modify: `src/shared/ui/ConfirmModal.tsx` (전체 재작성)

**Interfaces:**
- Consumes: `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` (Task 1) · `@shared/ui/Icon`(default) · `@shared/ui/Button` → `Button`
- Produces: `ConfirmModal` (default export) — props 무변경:
  `{ title: string; desc: React.ReactNode; confirmLabel: string; cancelLabel?: string; tone: "primary" | "danger"; onClose: () => void; onConfirm: () => void }`

- [ ] **Step 1: ConfirmModal.tsx 재작성**

Replace 전체 `src/shared/ui/ConfirmModal.tsx`:
```tsx
"use client";

import Icon from "@shared/ui/Icon";
import { Button } from "@shared/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@shared/ui/Dialog";

export default function ConfirmModal({
  title,
  desc,
  confirmLabel,
  cancelLabel = "취소",
  tone,
  onClose,
  onConfirm,
}: {
  title: string;
  desc: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone: "primary" | "danger";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent style={{ width: 460 }}>
        <div style={{ padding: "26px 26px 8px" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background:
                tone === "danger"
                  ? "rgba(255,66,66,0.10)"
                  : "var(--w-primary-soft)",
              color:
                tone === "danger"
                  ? "var(--w-status-negative)"
                  : "var(--w-primary-press)",
              display: "grid",
              placeItems: "center",
              marginBottom: 14,
            }}
          >
            <Icon name={tone === "danger" ? "warn" : "info"} size={20} />
          </div>
          <DialogTitle
            style={{
              font: "700 17px/1.35 var(--w-font-display)",
              color: "var(--w-fg-strong)",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div
              style={{
                font: "500 13.5px/1.6 var(--w-font-sans)",
                color: "var(--w-fg-neutral)",
                margin: "10px 0 0",
              }}
            >
              {desc}
            </div>
          </DialogDescription>
        </div>
        <div className="flex gap-2 justify-end px-6 py-[18px] border-t border-[var(--w-line-alternative)] mt-5">
          <Button variant="ghost" type="button" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

> `DialogDescription asChild` + 내부 `<div>` — desc가 블록 ReactNode일 수 있어 Radix 기본 `<p>` 대신 `<div>`로 렌더(잘못된 HTML 중첩 방지). 시각은 기존 inline style 그대로 옮겨 픽셀 동일. `<Dialog open …>`는 부모의 조건부 마운트(=열림) 모델을 보존.

- [ ] **Step 2: 타입체크**

Run:
```bash
npx tsc --noEmit
```
Expected: 에러 없음(clean).

- [ ] **Step 3: 회귀 테스트**

Run:
```bash
npx vitest run
```
Expected: `502 passed`.

- [ ] **Step 4: dev 육안 검증 (수동)**

dev 서버에서 ConfirmModal을 띄우는 화면(예: 캠페인 일시정지/예산변경 확인, 브랜드 프로필 삭제 등)을 열어 확인:
- [ ] 모달 시각 기존과 동일(아이콘 배지·타이틀·desc·푸터 버튼·라운드·그림자)
- [ ] ESC로 닫힘 (신규 — 기존엔 안 됐음)
- [ ] 백드롭(바깥) 클릭으로 닫힘 (기존 유지)
- [ ] 포커스가 모달 안에 갇힘(탭 순환), 닫으면 트리거로 복귀
- [ ] 다크모드에서 포털 토큰 정상(패널 bg·텍스트색)
- [ ] 콘솔에 Radix `DialogTitle`/`Description` 누락 경고 없음

- [ ] **Step 5: 커밋**

```bash
git add src/shared/ui/ConfirmModal.tsx
git commit -m "feat(shadcn): ConfirmModal을 Radix Dialog로 마이그 — 시각·props·호출부 무변경, ESC/포커스트랩/scroll-lock/aria-modal 순이득"
```

---

## Self-Review

**Spec coverage:**
- A안(얇은 래퍼+우리 토큰) → Task 1 Dialog.tsx ✅
- Q1 className 재작성(토큰만) → Global Constraints + Task 1 className ✅
- Q2 포털 container=.adflow → Task 1 `adflowContainer()` ✅
- Q3 Dialog 파일럿(프리미티브+ConfirmModal) → Task 1·2 ✅
- 테스트 b안 → Global Constraints + 각 Task의 tsc/vitest/육안 ✅
- 새 의존성 1개 → Task 1 Step 1 + Global Constraints ✅
- ConfirmModal 시각/호출부 무변경 → Task 2 Step 1(동일 props·동일 inline style) ✅
- 순이득(ESC/포커스/scroll-lock/aria) → Task 2 Step 4 육안 체크리스트 ✅

**Placeholder scan:** TBD/TODO 없음. 모든 코드 스텝에 전체 코드 포함. ✅

**Type consistency:** `Dialog`/`DialogContent`/`DialogTitle`/`DialogDescription` 이름이 Task 1 Produces와 Task 2 Consumes에서 일치. ConfirmModal props가 기존 시그니처와 동일. ✅
