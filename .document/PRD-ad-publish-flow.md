# PRD — 광고 집행 플로우 개선 (Meta API 정합성 + 영상 소재 지원)

> **한 줄 요약**: 현재 광고 집행 플로우를 Meta의 실제 광고 집행 구조와 일치하도록 개선한다. 캠페인 목표 선택(TRAFFIC / AWARENESS), 영상 소재 지원, 특별 광고 카테고리, 상태 수동 확인을 추가하고 목표별 API 파라미터 자동 매핑을 구현한다.

- 문서 버전: v0.1
- 작성일: 2026-05-12
- 상태: 기획 논의 완료 — 디자인은 Claude Design에서 동시 진행 중 (`.document/ad-publish-flow-design-prompt.md` 참조)
- 대상 사용자: **기업 내 마케터**

---

## 1. 배경 & 목적

### 1.1 지금 상태의 문제

현재 광고 집행 플로우(`LaunchTab` → `/api/campaign`)는 Meta API를 호출하지만, 실제 Meta 광고 집행 구조와 일치하지 않는 부분이 있다.

| 항목 | 현재 구현 | 실제 Meta 요구사항 |
|---|---|---|
| 캠페인 목표 | `OUTCOME_TRAFFIC` 고정 | 목표별 선택 필요 |
| optimization_goal | 미지정(Meta 기본값 의존) | 목표마다 다르게 지정 필수 |
| 광고 소재 포맷 | 단일 이미지만 | 영상(Single Video) 추가 필요 |
| 특별 광고 카테고리 | `[]` 고정 | 금융·채용·부동산·정치 시 신고 필수 |
| 랜딩 URL | 전 목표 필수 | AWARENESS는 선택 |
| 집행 후 상태 확인 | 정적 배지만 표시 | 실제 Meta 상태 조회 필요 |
| 영상 업로드 | 미구현 | 별도 업로드 API 필요 |

### 1.2 왜 지금 고치나

기업 마케터는 목적에 따라 인지도·트래픽 캠페인을 구분해서 운영한다. 목표가 잘못 설정된 캠페인은 Meta 알고리즘 최적화가 전혀 다르게 동작해 광고비 낭비로 이어진다. 또한 특별 광고 카테고리 미신고는 Meta 계정 정지 위험이 있다.

---

## 2. 목표 / 비목표

### 2.1 목표

1. **캠페인 목표 선택 UI 추가** — TRAFFIC / AWARENESS 2가지 선택 (SALES는 Pixel 연동 후 후속)
2. **목표별 API 파라미터 자동 매핑** — `optimization_goal` / `billing_event`를 목표에 따라 자동 설정
3. **영상 소재 지원 (Single Video)** — 별도 업로드 Route Handler + Meta 영상 처리 완료 폴링
4. **영상 썸네일 업로드** — 직접 업로드(선택), 미입력 시 자동 추출 fallback
5. **특별 광고 카테고리 선택 UI 추가** — 집행 설정에 선택 항목, 선택 시 타겟팅 제한 안내
6. **랜딩 URL 조건부 필수** — TRAFFIC: 필수 / AWARENESS: 선택
7. **광고 검토 상태 수동 확인** — 집행 성공 카드에 "상태 확인" 버튼 추가

### 2.2 비목표 (현 범위 밖 — 후속)

- ❌ `OUTCOME_SALES` — Meta Pixel 연동 이슈로 후속 작업
- ❌ Campaign Budget Optimization (CBO) — 다중 AdSet 지원 후 후속
- ❌ 다중 AdSet / 다중 Ad (A/B 테스트) — 후속
- ❌ 입찰가 직접 설정 (Bid Cap / Cost Cap) — 후속
- ❌ Carousel / Collection 포맷 — 후속
- ❌ 자동 폴링(상태 실시간 갱신) — 수동 새로고침만
- ❌ 모바일 반응형

---

## 3. 결정 사항 상세

### 3.1 캠페인 목표

| 목표 | 지원 여부 | 이유 |
|---|---|---|
| `OUTCOME_TRAFFIC` | ✅ 지원 | 기존 구현, 웹사이트 방문 유도 |
| `OUTCOME_AWARENESS` | ✅ 지원 | 브랜드 인지도, 노출 극대화 |
| `OUTCOME_SALES` | ⏳ 후속 | Meta Pixel 연동 필수 — 이번 범위 밖 |
| `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_APP_PROMOTION` | ❌ 미지원 | 추후 기획 |

### 3.2 목표별 API 파라미터 자동 매핑

목표 선택 시 `lib/meta-ads.ts`에서 자동으로 아래 값을 결정한다. 마케터가 직접 설정하지 않는다.

| 캠페인 목표 | `optimization_goal` | `billing_event` |
|---|---|---|
| `OUTCOME_TRAFFIC` | `LINK_CLICKS` | `IMPRESSIONS` |
| `OUTCOME_AWARENESS` | `REACH` | `IMPRESSIONS` |

### 3.3 광고 소재 포맷

| 포맷 | 지원 여부 |
|---|---|
| Single Image | ✅ 기존 유지 |
| Single Video | ✅ 이번에 추가 |
| Carousel | ⏳ 후속 |
| Collection | ❌ 미지원 |

### 3.4 영상 업로드 사양

- 별도 Route Handler: `POST /api/upload-video`
- 전송 방식: FormData (base64 불가, 파일 직접 전송)
- 최대 파일 크기: **500MB**
- 권장 포맷: MP4, MOV
- 업로드 흐름:
  1. `POST /{accountId}/advideos` → `video_id` 반환
  2. Meta 영상 처리 완료 폴링 (`GET /{video_id}?fields=status`)
  3. 처리 완료 후 Creative 생성에 `video_id` 사용
- 썸네일: 직접 업로드(선택). 미입력 시 Meta 자동 추출(첫 프레임) fallback

### 3.5 랜딩 URL 조건부 필수

| 목표 | 랜딩 URL | 집행 가드 |
|---|---|---|
| `OUTCOME_TRAFFIC` | **필수** (현재와 동일) | URL 없으면 집행 버튼 비활성 |
| `OUTCOME_AWARENESS` | 선택 | URL 없어도 집행 가능. URL 없으면 CTA 버튼 미포함 |

### 3.6 특별 광고 카테고리

집행 설정 화면에 선택 항목 추가. 기본값 없음(해당 없음).

| 코드 | 의미 | 해당 업종 |
|---|---|---|
| `CREDIT` | 신용·금융 | 대출, 신용카드, 보험 |
| `EMPLOYMENT` | 채용·구인 | 구인 플랫폼, 인재채용 |
| `HOUSING` | 부동산·임대 | 부동산 매매/임대 |
| `ISSUES_ELECTIONS_POLITICS` | 정치·선거 | 정치 광고, 공익 캠페인 |

선택 시 UI에서 타겟팅 제한 안내 표시:
- 연령 18세 미만 타겟 불가
- 일부 국가 타겟 불가 (Meta 정책 따름)

### 3.7 광고 검토 상태 확인

집행 성공(`CampaignSuccessCard`) 카드에 "상태 확인" 버튼 추가.

```
집행 직후: PENDING_REVIEW
→ 검토 통과: ACTIVE
→ (문제 시): DISAPPROVED
```

- 기존 `GET /api/insights/[campaignId]` 또는 별도 `GET /api/campaign/status/[campaignId]` 를 통해 `effective_status` 조회
- 자동 폴링 없음 — 수동 버튼 클릭 시 1회 호출
- `DISAPPROVED` 시 "Meta 광고 관리자에서 사유 확인 →" 외부 링크 표시

### 3.8 입찰 전략

- `LOWEST_COST_WITHOUT_CAP` (Meta 기본 자동입찰) 고정 사용
- 입찰가 직접 설정(Bid Cap / Cost Cap)은 후속 기능

### 3.9 캠페인 구조

- **1 Campaign : 1 AdSet : 1 Ad** 구조 유지
- CBO(Campaign Budget Optimization) 및 다중 AdSet은 후속

---

## 4. 변경이 필요한 파일

### 4.1 기존 파일 수정

| 파일 | 변경 내용 |
|---|---|
| `lib/meta-ads.ts` | 목표별 `optimization_goal` 매핑 함수 추가, `special_ad_categories` 파라미터 추가, 영상 광고 Creative 구조 분기 |
| `app/api/campaign/route.ts` | 목표·포맷·special_ad_categories 파라미터 수신, `meta-ads.ts` 신규 함수 호출 |
| `app/_components/LaunchTab.tsx` | 목표 선택 UI, 포맷 선택 UI, 특별 카테고리 선택 UI, 랜딩 URL 조건부 필수 처리 |
| `app/_components/LaunchSettingsForm.tsx` | 위 UI 컴포넌트 포함 |
| `app/_components/CampaignSuccessCard.tsx` | "상태 확인" 버튼 추가 |
| `app/_hooks/useLaunchCampaign.ts` | 목표·포맷·special_ad_categories 상태 추가, 영상 업로드 흐름 분기 |

### 4.2 신규 파일

| 파일 | 내용 |
|---|---|
| `app/api/upload-video/route.ts` | 영상 업로드 Route Handler (FormData → Meta `advideos` API → 처리 완료 폴링) |

---

## 5. 작업 계획 (단계)

0. **Claude Design 시안 받기** → 사람 리뷰: 목표 선택 UI 배치, 포맷 선택 UI 배치, 특별 카테고리 UI, 영상 업로드 UX 확인
1. **`lib/meta-ads.ts` 개선** — 목표별 파라미터 매핑, 영상 Creative 구조 분기, `special_ad_categories` 지원
2. **`/api/upload-video` 신규** — FormData 수신, Meta `advideos` 업로드, 처리 완료 폴링
3. **`/api/campaign` 수정** — 신규 파라미터 수신 및 전달
4. **집행 설정 UI 수정** — 목표 선택, 포맷 선택(이미지/영상 + 썸네일), 특별 카테고리, 랜딩 URL 조건부
5. **`CampaignSuccessCard` 수정** — "상태 확인" 버튼 추가
6. **QA** — 목표별 API 파라미터 정확성, 영상 업로드/썸네일 동작, 특별 카테고리 전달, 가드 조건(TRAFFIC 랜딩 URL 필수/AWARENESS 선택), DISAPPROVED 상태 표시, tsc·린트·콘솔 클린

> **후속(이번 범위 밖, 메모)**: OUTCOME_SALES + Pixel 연동, CBO + 다중 AdSet, Carousel 포맷, 입찰가 직접 설정, 자동 폴링, 모바일 반응형.

---

## 6. 인수 조건

**목표 선택**
- [ ] 집행 설정 화면에서 TRAFFIC / AWARENESS 선택 가능
- [ ] 목표 선택에 따라 `optimization_goal` / `billing_event`가 자동 매핑되어 API에 전달됨

**소재 포맷**
- [ ] 이미지 / 영상 포맷 선택 UI 존재
- [ ] 영상 선택 시 영상 파일(MP4/MOV, 최대 500MB) 업로드 가능
- [ ] 영상 선택 시 썸네일 이미지 업로드 가능 (선택, 미입력 시 자동 추출 fallback)
- [ ] 영상 업로드 후 Meta 처리 완료 전 집행 버튼 비활성 또는 처리 중 안내 표시

**랜딩 URL**
- [ ] TRAFFIC 목표 선택 시 URL 없으면 집행 버튼 비활성
- [ ] AWARENESS 목표 선택 시 URL 없어도 집행 가능

**특별 광고 카테고리**
- [ ] 집행 설정 화면에 "특별 광고 카테고리" 선택 항목 존재 (선택 사항)
- [ ] 선택 시 타겟팅 제한 안내 UI 표시
- [ ] 선택한 카테고리가 `special_ad_categories` 파라미터로 Meta API에 전달됨

**광고 검토 상태**
- [ ] 집행 성공 카드에 "상태 확인" 버튼 존재
- [ ] 버튼 클릭 시 Meta API에서 `effective_status` 조회 후 표시
- [ ] `DISAPPROVED` 상태 시 "Meta 광고 관리자에서 사유 확인" 외부 링크 표시

**기존 기능 유지**
- [ ] 기존 이미지 광고 집행 동작 동일
- [ ] 예산, 기간, 타겟팅, 게재 상태 등 기존 입력 항목 그대로 유지
- [ ] `tsc` 통과, 린트 통과, 콘솔 에러 없음

---

## 7. 참고 파일

- 수정 대상: `lib/meta-ads.ts`, `app/api/campaign/route.ts`, `app/_components/LaunchTab.tsx`, `app/_components/LaunchSettingsForm.tsx`, `app/_components/CampaignSuccessCard.tsx`, `app/_hooks/useLaunchCampaign.ts`
- 신규: `app/api/upload-video/route.ts`
- 선행 문서: `docs/PRD.md` (디자인시스템 이관 — 전체 IA 기준), `.document/PRD-ad-publish-flow.md` (이 문서)
- 디자인 프롬프트: `.document/ad-publish-flow-design-prompt.md`
