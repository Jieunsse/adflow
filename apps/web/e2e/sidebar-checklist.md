# 둘러보기 모드 사이드바 E2E 체크리스트

검토 기준: 메뉴를 클릭했을 때 목표 경로로 이동하고 워크스페이스 화면이 렌더링돼요. 채널 메뉴는 하위 메뉴가 펼쳐져야 해요.

실행: `pnpm test:e2e` (2026-08-11)

## 메인

- [x] 대시보드 — `/dashboard`
- [x] 목표 — `/goals`
- [x] 광고 만들기 — `/create`

## 캠페인 관리

- [x] 캠페인 — `/campaigns`
- [x] A/B 테스트 — `/ab-tests`
- [x] 승인 대기 — `/approvals`
- [x] 소재 라이브러리 — `/library`

## 인플루언서

- [x] 크리에이터 — `/creators`
- [x] 협업 캠페인 — `/creators/campaigns`
- [x] 파트너십 콘텐츠 — `/instagram/partnerships`

## 채널 관리

- [x] Instagram 메뉴 펼치기
- [x] Instagram 인사이트 — `/instagram`
- [x] Instagram 게시 — `/instagram/posts`
- [x] Instagram 댓글 관리 — `/instagram/comments`
- [x] Instagram 스토리 — `/instagram/stories`
- [x] Instagram 릴스 — `/instagram/reels`
- [x] Instagram 메시지 — `/instagram/messages`
- [x] Facebook 메뉴 펼치기
- [x] Facebook 인사이트 — `/facebook`
- [x] Facebook 게시물 — `/facebook/posts`

## 브랜드 & 정책

- [x] 브랜드 프로필 — `/brand-profile`

## 워크스페이스

- [x] 구성원 · 권한 — `/members`
- [x] 계정 연결 — `/connect`
- [x] 청구 및 결제 — `/billing`
- [x] 설정 — `/settings`
