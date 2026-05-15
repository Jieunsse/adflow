# Gemini 이미지 생성 로직 — Baseline (개선 전 스냅샷)

> 작성일: 2026-05-13
> 대상 커밋 기준: `4189e68` 이후 (개선 적용 직전 상태)
> 목적: Tier 1 속도 개선(STAGGER / RETRY 상수 축소) 적용 **전** 상태를 보존해, 이후 비교·롤백·튜닝의 기준점으로 삼는다.

---

## 1. 진입점 & 파일 구조

| 레이어            | 파일                                                                 | 역할                                                                         |
| ----------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 클라이언트 훅     | `app/_hooks/useGenerateImage.ts`                                     | `useApiMutation` 래퍼. `POST /api/generate-image` 호출                       |
| 클라이언트 호출부 | `app/(workspace)/create/_components/CreativeStep.tsx` `AiImageBlock` | "이미지 3장 생성" 버튼 → `gen.mutate({ prompt, referenceImages, count: 3 })` |
| Route Handler     | `app/api/generate-image/route.ts`                                    | 입력 검증(`MAX_REFERENCE_IMAGES = 6`), `geminiImage.generate()` 위임         |
| Server adapter    | `lib/gemini-image.ts`                                                | Gemini SDK 호출 + 슬롯·재시도·모델 폴백 로직                                 |

`useApiMutation` 은 React Query mutation 기반, fetch + JSON 표준 흐름.

---

## 2. 요청·응답 모양

### 요청 (`POST /api/generate-image`)

```json
{
  "prompt": "미니멀한 욕실 선반에 놓인 비건 수분크림, 아침 햇살, 파스텔 톤",
  "referenceImages": [{ "mimeType": "image/jpeg", "dataBase64": "..." }],
  "count": 3
}
```

### 응답

```json
{
  "images": [
    "data:image/png;base64,iVBORw0KG...",
    "data:image/png;base64,iVBORw0KG...",
    "data:image/png;base64,iVBORw0KG..."
  ]
}
```

한 장당 base64 DataURL. 보통 PNG, ~700KB ~ 1.5MB. JSON 전체 ~3MB.

---

## 3. 서버 로직 흐름 (`lib/gemini-image.ts`)

```
geminiImage.generate({ prompt, referenceImages, count })
├─ count = clamp(1, 4, count ?? 3)         // DEFAULT_COUNT=3, MAX_COUNT=4
├─ contents = [{text: prompt}, ...refs.map(inlineData)]
├─ ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })
└─ Promise.all([
     slot(0): sleep(0ms)    → generateSlot()
     slot(1): sleep(600ms)  → generateSlot()    ← STAGGER_MS
     slot(2): sleep(1200ms) → generateSlot()
   ])

generateSlot(ai, contents, slot):
  for attempt in [1, 2]:
    try:
      img = attemptGenerate(ai, contents)
      if img: return img
      // 응답 O / 이미지 X (safety block 등)
      if attempt == 1: sleep(1500ms); continue   ← RETRY_DELAY_MS
      return null
    catch:
      if attempt == 1: sleep(1500ms); continue
      return null

attemptGenerate(ai, contents):
  for model in [
    "gemini-2.0-flash-preview-image-generation",  // 1순위 (대부분 키 호환)
    "gemini-2.5-flash-image"                       // 2순위 (preview 등록 키)
  ]:
    try:
      response = ai.models.generateContent({
        model,
        contents,
        config: { responseModalities: ["image", "text"] }
      })
      for part in response.candidates[0].content.parts:
        if part.inlineData?.data:
          return `data:${mime};base64,${data}`
      return null   // 이미지 없으면 다음 모델로 폴백 안 함 (주석: 같은 모델 재시도가 alias 폴백보다 낫다)
    catch:
      // 다음 모델로 폴백
  throw
```

---

## 4. 상수 (`lib/gemini-image.ts`)

| 상수             | 값                                                                        | 의미                                                             |
| ---------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `IMAGE_MODELS`   | `["gemini-2.0-flash-preview-image-generation", "gemini-2.5-flash-image"]` | 모델 폴백 순서 (커밋 `592a3fc` 에서 프로덕션 호환 모델로 교체됨) |
| `DEFAULT_COUNT`  | `3`                                                                       | PRD 1라운드 3장                                                  |
| `MAX_COUNT`      | `4`                                                                       | 안전 상한                                                        |
| `STAGGER_MS`     | **`600`**                                                                 | 슬롯 간 시작 시각 차 — 동시 요청 폭발 방지 목적                  |
| `RETRY_DELAY_MS` | **`1500`**                                                                | 슬롯 내 1차 실패 후 재시도 전 sleep                              |

---

## 5. 시간 예산 (worst/best/avg)

> 측정치 아닌 대략. Gemini 이미지 모델 한 슬롯 호출은 4~8s 범위.

| 단계                                  | 시간                      |
| ------------------------------------- | ------------------------- |
| slot 0 시작 (t=0ms) → 응답            | 4~8s                      |
| slot 1 시작 (t=600ms) → 응답          | 0.6s + 4~8s               |
| slot 2 시작 (t=1200ms) → 응답         | 1.2s + 4~8s               |
| **Promise.all 종료 (= max slot)**     | **5.2~9.2s** (happy path) |
| 1슬롯 실패→재시도 발생 시 추가        | +1.5s + 4~8s              |
| **worst case (모든 슬롯 1회 재시도)** | **~11~14s**               |
| Base64 JSON 응답 직렬화/전송 (~3MB)   | 0.5~1.5s                  |
| 클라이언트 `<img src>` 디코드         | 1MB 당 100~300ms          |
| **체감 총 대기 (happy path)**         | **6~10s**                 |
| **체감 총 대기 (worst)**              | **12~15s**                |

UI 안내문구: "AI가 이미지를 만들고 있어요… (10~30초 정도 걸려요)" — `CreativeStep.tsx:352`

---

## 6. 병목 분석

1. **STAGGER 누적 1.2s 순수 대기**. 마지막 슬롯이 시작도 못 한 채로 1.2s 흘러감. Gemini AI Studio RPM 한도(분당)는 동시성 3개에 영향 없어 안전권. → **Tier 1 A 에서 100ms 로 축소 예정**.
2. **RETRY_DELAY 1500ms 보수적**. Safety-block 류는 재시도해도 거의 같은 결과 → 차라리 빠르게 포기하고 다른 슬롯 결과로 보전. → **Tier 1 B 에서 500ms 로 축소 예정**.
3. **Promise.all 일괄 대기**. slot 0 가 3s 에 끝나도 사용자는 worst slot 끝까지 기다림 → Tier 2 (스트리밍) 대상.
4. **Base64 DataURL JSON 일괄 전송**. JSON ~3MB → 모바일 네트워크 체감 큼 → Tier 2/3 (압축·URL 화) 대상.
5. **모델 폴백 직렬**. 1번 모델이 자주 빈응답이면 누적 손해. 다만 현재 1번 모델은 `592f3fc` 커밋에서 호환성 검증된 거라 일반적으로 happy path 에선 영향 없음.
6. **`candidateCount` 미사용**. Gemini 이미지 모드가 multi-candidate 를 지원하는지 미확인 — 지원 시 3호출 → 1호출로 큰 단축 가능. Tier 3 조사 대상.

---

## 7. 클라이언트 관찰 가능 동작

- 버튼 클릭 → 텍스트만 "AI가 이미지를 만들고 있어요…" 표시 (`CreativeStep.tsx:351-353`).
- 3장이 **동시에** 한꺼번에 등장 (Promise.all 응답 직후).
- 도착한 이미지 중 0장이면 toast 에러 ("이미지 생성에 실패했어요"), 1~2장이면 "이미지 N장만 생성됐어요" 안내 (`CreativeStep.tsx:275`).

---

## 8. 다음 단계 — Tier 1 적용 계획 (이 문서 직후 진행)

| 변경             | 위치                  | Before → After | 기대 효과                          |
| ---------------- | --------------------- | -------------- | ---------------------------------- |
| `STAGGER_MS`     | `lib/gemini-image.ts` | `600` → `100`  | -1s (마지막 슬롯이 0.2s 안에 시작) |
| `RETRY_DELAY_MS` | `lib/gemini-image.ts` | `1500` → `500` | -1s (재시도 발생 시)               |

총 happy path 단축: **약 -1s** / worst case 단축: **약 -2s**.

코드 변경량: 상수 2개 라인만. 회귀 위험: 매우 낮음 (RPM 한도 영향 없음, 재시도는 여전히 동작).

문서 작성 후, 같은 세션에서 위 변경을 바로 적용한다.
