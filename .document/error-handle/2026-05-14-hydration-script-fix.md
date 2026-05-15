# Hydration 불일치 + Script 경고 수정

**날짜:** 2026-05-14

---

## 에러 1 — Script 경고

**메시지:** `Encountered a script tag while rendering React component`

**원인:** `app/layout.tsx`에서 `<script dangerouslySetInnerHTML>` 태그를 직접 썼는데, React 18+은 컴포넌트 안에서 script 태그 실행을 막음.

**수정:** `next/script`의 `<Script strategy="beforeInteractive">` 로 교체.

---

## 에러 2 — Hydration 불일치

**메시지:** `Hydration failed because the server rendered text didn't match the client`

**원인:** `useSessionStorage` 훅이 서버에서는 기본값(`""`)을 쓰고, 클라이언트에서는 `sessionStorage`에 저장된 값(`"브랜드 인지도 높이기"`)을 바로 읽어서 첫 렌더 결과가 달라짐.

```
서버 렌더 → "" → Select 플레이스홀더 "선택해주세요" 표시
클라이언트  → "브랜드 인지도 높이기" → 선택된 값 표시
→ 불일치!
```

**수정:** 서버/클라이언트 첫 렌더를 모두 기본값으로 맞추고, 마운트 후 `useEffect`에서 `sessionStorage` 값을 읽어 동기화.

---

## 두 에러의 연관성

직접 연결은 아니지만 **같은 원인 패턴** — SSR(서버)과 클라이언트의 초기 렌더 결과를 다르게 만드는 코드. React는 두 결과가 일치해야 hydration이 정상 동작함.

---

## 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `app/layout.tsx` | `<script>` → `<Script strategy="beforeInteractive">` |
| `src/shared/lib/storage/useSessionStorage.ts` | 초기값 항상 `initialValue`, 마운트 후 storage 동기화 |
