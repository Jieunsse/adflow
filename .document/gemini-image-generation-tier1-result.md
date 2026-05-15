# Gemini 이미지 생성 로직 — Tier 1 개선 결과

> 작성일: 2026-05-14
> 대상 커밋: `feat/design-shell-phase1` 브랜치 최신 (`lib/gemini-image.ts`)
> 목적: Tier 1 속도 개선 적용 **후** 상태를 측정·기록하고, 베이스라인 대비 변화를 브리핑한다.
> 참고 문서: [`.document/gemini-image-generation-baseline.md`](./gemini-image-generation-baseline.md)

---

## 1. 적용된 변경 사항

Tier 1은 코드 2줄의 상수 변경 + 구조 개선으로 구성됐다.

### A. 상수 변경

| 상수             | Before | After  | 의도                                              |
| ---------------- | ------ | ------ | ------------------------------------------------- |
| `STAGGER_MS`     | `600`  | `100`  | 슬롯 간 시작 간격 최소화 — Gemini RPM 한도 무관   |
| `RETRY_DELAY_MS` | `1500` | `500`  | 재시도 sleep 단축 — 빠른 포기 후 다른 슬롯 결과로 |

### B. `preferredModel` 프로세스 캐싱 (신규)

```ts
let preferredModel: string | null = null;

// attemptGenerate 내부
if (preferredModel !== model) preferredModel = model; // 첫 성공 모델 캐싱
```

- 첫 번째 이미지 생성 시 어느 모델이 응답했는지 기억.
- 이후 같은 프로세스 내 요청에서는 성공 모델을 1순위로 배치 → 404 폴백 왕복 제거.
- 프로세스 재시작 시 초기화. 콜드 스타트에선 이득 없음.

### C. `resolveModels()` env 오버라이드 (신규)

```ts
const env = process.env.GEMINI_IMAGE_MODEL?.trim();
if (env) return env.split(",").map(s => s.trim()).filter(Boolean);
```

- `.env.local` 에서 `GEMINI_IMAGE_MODEL=모델A,모델B` 형식으로 모델 순서를 런타임 교체 가능.
- 성능 직접 영향은 없으나 모델 전환 시 재배포 없이 대응 가능.

---

## 2. 시간 예산 (개선 후)

> 베이스라인과 동일하게 Gemini 이미지 모델 한 슬롯 호출 4~8s 가정.

| 단계                                     | 시간                       |
| ---------------------------------------- | -------------------------- |
| slot 0 시작 (t=0ms) → 응답               | 4~8s                       |
| slot 1 시작 (t=100ms) → 응답             | 0.1s + 4~8s                |
| slot 2 시작 (t=200ms) → 응답             | 0.2s + 4~8s                |
| **Promise.all 종료 (= max slot)**        | **4.2~8.2s** (happy path)  |
| 1슬롯 실패→재시도 발생 시 추가           | +0.5s + 4~8s               |
| **worst case (모든 슬롯 1회 재시도)**    | **~8.7~12s**               |
| Base64 JSON 응답 직렬화/전송 (~3MB)      | 0.5~1.5s                   |
| 클라이언트 `<img src>` 디코드            | 1MB 당 100~300ms           |
| **체감 총 대기 (happy path)**            | **5~10s**                  |
| **체감 총 대기 (worst)**                 | **9~13s**                  |

---

## 3. 개선 전후 비교

| 항목                            | Before (베이스라인)       | After (Tier 1)             | 차이        |
| ------------------------------- | ------------------------- | -------------------------- | ----------- |
| `STAGGER_MS`                    | 600ms                     | 100ms                      | **-500ms**  |
| `RETRY_DELAY_MS`                | 1500ms                    | 500ms                      | **-1000ms** |
| STAGGER 누적 (slot 2 기준)      | 1200ms                    | 200ms                      | **-1000ms** |
| **happy path Promise.all**      | **5.2~9.2s**              | **4.2~8.2s**               | **-1s**     |
| **1슬롯 재시도 포함**           | +1500ms + 4~8s = +5.5~9.5s | +500ms + 4~8s = +4.5~8.5s | **-1s**     |
| **worst case (전 슬롯 재시도)** | **~11~14s**               | **~8.7~12s**               | **-2~2.3s** |
| **체감 총 대기 (happy)**        | **6~10s**                 | **5~10s**                  | 최대 -1s    |
| **체감 총 대기 (worst)**        | **12~15s**                | **9~13s**                  | 최대 -2~3s  |
| `preferredModel` 캐싱           | 없음                      | 있음                       | 2회째부터 모델 폴백 생략 |
| 모델 env 오버라이드             | 없음                      | 있음                       | 운영 유연성 향상 |

---

## 4. 병목 현황 (Tier 1 이후 잔존)

Tier 1 으로 단순 대기(sleep) 병목 2개를 제거했으나, 구조적 병목은 그대로다.

| 순위 | 병목                              | 현재 상태            | 다음 단계 (Tier 2/3)            |
| ---- | --------------------------------- | -------------------- | ------------------------------- |
| 1    | **Promise.all 일괄 대기**         | worst slot 끝까지 블로킹 | 스트리밍 — slot 완료 즉시 렌더 |
| 2    | **Base64 JSON 일괄 전송 (~3MB)**  | 전체 완료 후 전송    | 압축 / Object URL 화            |
| 3    | **candidateCount 미사용**         | 3호출 필요           | multi-candidate 지원 여부 확인  |
| 4    | **모델 폴백 직렬**                | preferredModel 로 1회 완화 | 모델 안정화 후 단일 모델 고정  |

---

## 5. 클라이언트 관찰 가능 동작 (개선 후 동일)

- 버튼 클릭 → "AI가 이미지를 만들고 있어요… (10~30초 정도 걸려요)" 스피너.
- 3장이 **동시에** 한꺼번에 등장 (Promise.all 전체 완료 후).
- 0장 도착 시 toast 에러, 1~2장 시 "N장만 생성됐어요" 안내.

UI 문구의 "10~30초" 안내는 개선 후 실측과 다소 괴리가 생겼다.  
happy path 기준 5~10s 이므로 "보통 5~10초, 느릴 땐 최대 15초" 수준으로 조정하는 것이 유저 기대 관리에 유리하다.

---

## 6. 실측 방법 (다음 측정 시 참고)

아래 절차로 실제 레이턴시를 수집할 것을 권장한다.

```bash
# 1. 개발 서버 실행 후 아래 curl 로 직접 측정
time curl -s -X POST http://localhost:3000/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt":"minimal bathroom shelf skincare product, morning sunlight, pastel tone","count":3}' \
  -o /dev/null

# 2. 서버 콘솔의 [gemini-image] warn 로그로 슬롯별 실패·재시도 확인
# 3. 브라우저 DevTools → Network → /api/generate-image → Timing TTFB 확인
```

측정 조건:
- 레퍼런스 이미지 없는 텍스트 only 요청 (가장 빠른 베이스)
- 레퍼런스 1장 첨부 요청 (실사용 시나리오)
- 3회 연속 요청 (preferredModel 캐싱 효과 확인)
