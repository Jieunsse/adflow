# 대시보드 Lighthouse 성능 개선

측정일: 2026-08-07 (KST)
대상: 게스트 세션의 `/dashboard`
조건: 프로덕션 빌드, 새 Chrome 프로필마다 재로그인한 콜드 캐시, Lighthouse 12.8.2·Chrome 143·모바일 에뮬레이션(412×823)·simulated throttling

## 성능 개선

- 대시보드 첫 화면에서 Pretendard 4~5개 weight가 함께 요청되어 약 4.22MB를 전송하고, 핵심 요약 문구의 LCP를 23.9초까지 지연시키는 문제를 확인했어요.
- 디자인 토큰의 기존 시스템 폰트 fallback 체인을 기본값으로 사용하도록 바꿔 웹폰트 요청을 제거했어요. 새 패키지나 런타임 코드는 추가하지 않았고, 인증된 워크스페이스 전체에 적용돼요.
- FCP는 이미 1초 미만이어서 유지했고, 실제 병목인 LCP·전송량·상호작용 완료 시점을 줄였어요.

| 항목 | 개선 전 | 개선 후 | 변화 |
| --- | ---: | ---: | ---: |
| Lighthouse Performance | 75 | 92 | +17점 |
| FCP | 0.95초 | 0.95초 | 유지 |
| LCP | 23.9초 | 3.3초 | 20.6초 단축 (86%) |
| Interactive | 23.9초 | 3.3초 | 20.6초 단축 |
| 전송량 | 4.22MB | 306KB | 3.92MB 절감 (93%) |
| 웹폰트 요청 | 5건 | 0건 | 제거 |
| TBT | 73ms | 55ms | 18ms 단축 |
| CLS | 0.009 | 0.009 | 유지 |

## 검증 근거

- 개선 전 LCP 요소: 대시보드 히어로의 핵심 성과 요약 문구
- 개선 전 LCP 지연의 97%: 폰트 렌더 대기
- 개선 후 Lighthouse 품질 점수: Accessibility 95, Best Practices 96, SEO 100으로 유지
- `npm run build` 통과

원본 Lighthouse JSON은 로컬 `.scratch/lighthouse-dashboard-cold-before/dashboard.json` 및 `.scratch/lighthouse-dashboard-cold-final/dashboard.json`에 보관했어요.
