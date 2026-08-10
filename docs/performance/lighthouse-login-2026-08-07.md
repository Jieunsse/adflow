# `/login` Lighthouse 성능 전후 비교

측정일: 2026-08-07 (KST)
대상: `http://127.0.0.1:3100/login` — 프로덕션 빌드·로컬 서버
도구: Lighthouse 12.8.2, Headless Chrome 143, 모바일 에뮬레이션(412×823), simulated throttling
범위: 로그인 전 공개 경로. 인증이 필요한 워크스페이스 화면은 이번 비교에서 제외했다.

## 결과

| 항목 | 개선 전 | 개선 후 | 변화 |
| --- | ---: | ---: | ---: |
| Performance | 55 | 65 | +10점 |
| FCP | 21.6초 | 4.8초 | 16.8초 단축 |
| LCP | 22.8초 | 6.3초 | 16.5초 단축 |
| Speed Index | 21.6초 | 4.8초 | 16.8초 단축 |
| TBT | 0ms | 0ms | 유지 |
| CLS | 0 | 0 | 유지 |
| Accessibility | 95 | 95 | 유지 |
| Best Practices | 100 | 100 | 유지 |
| SEO | 91 | 91 | 유지 |

## 진단과 실행 계획

1. 기준선에서 `globals.css`의 Google Fonts `@import`가 렌더링을 막고, 로컬 Pretendard 선언과 중복되는 것을 확인했다.
2. 먼저 중복 외부 import를 제거했다. 로컬 `@font-face`의 Pretendard와 디자인 토큰은 그대로라 화면 폰트 계약은 바뀌지 않는다.
3. 같은 조건에서 재측정해 FCP·LCP 개선과 품질 점수 비회귀를 확인했다.

## 변경

- `apps/web/app/globals.css`: 중복 Google Fonts import 제거
- 프로덕션 측정을 막던 타입 참조 두 곳도 실제 선언으로 복구
  - `billing/page.tsx`: `Billing` type import 추가
  - `gemini-creative.ts`: 삭제된 SOP 저장소 경로 대신 `brand-profile/model/policy`의 `SopSection` import

## 남은 병목과 다음 측정

이후 웹폰트 요청을 제거하는 워크스페이스 전역 개선을 적용했고, 게스트 대시보드의 콜드 측정 결과는 `lighthouse-dashboard-2026-08-07.md`에 기록했다.

원본 Lighthouse JSON은 로컬 `.scratch/lighthouse-before/login.json` 및 `.scratch/lighthouse-after/login.json`에 보관했다.
