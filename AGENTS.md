# AI Agents Guide

이 프로젝트의 **모든 AI 에이전트 행동 규칙** 이에요. Claude Code, Codex, 다른 어떤 AI 도구든 이 파일이 source-of-truth.

## Framework-Specific Rules (Next.js)

- `lib/axhub.ts` 는 **Server-side 전용**. `"use client"` 컴포넌트에서 import 금지 (`APPHUB_API_KEY` 가 브라우저로 새요).
- 새 axhub API 호출은 항상 Route Handler (`app/api/.../route.ts`) 또는 Server Action 경유.
- Tailwind class 는 길어도 분리하지 말고 인라인 유지 (vibe coder 가 한 곳에서 다 보는 게 편함).
- 변경 보고: `file:line` 형식.

## Design System (Wanted DS) — [ADR-049](./.document/adr/ADR-049-design-tokens-single-source.md)

`app/styles/design-system.css` 의 시맨틱 토큰·`w-*` 타입 스케일이 색·타이포의 **단일 소스**. 강제는 lint 아닌 **컨벤션**(이 문서) — 리뷰/에이전트가 잡는다.

- 색은 토큰(`--w-*`)으로. **신규 코드에 raw hex/rgba 금지** (smell). 대응 토큰 없으면 *지어내지 말고* 시맨틱 토큰을 신설(`-soft` 틴트·`green-700` 등 숫자 스케일 = 읽는 텍스트·`--w-focus-ring`·`--w-brand-facebook`).
- 헤딩/캡션/오버라인 타이포는 `w-h1`~`w-h4`·`w-body`·`w-label`·`w-caption`·`w-overline` 클래스로. **임의 `text-[13.5px]` 같은 반픽셀/매직 사이즈 금지**.
- 마이그레이션은 점진 — 만지는 코드의 raw 값만 기회적 치환. `shared/ui` 는 근원이라 별도 1회 스윕 대상.

## 절대 규칙 (negative-phrased)

- DO NOT `APPHUB_API_KEY` 를 클라이언트 컴포넌트 / 응답 본문 / 로그 어디에도 노출.
- DO NOT `.env.local` 커밋 (`.gitignore` 막혀있지만 force-add 도 금지).
- DO NOT 사용자 동의 없이 destructive git (`reset --hard`, `push --force`, `branch -D`).
- DO NOT 새 npm 패키지 사용자 확인 없이 설치.
- DO NOT 코드가 스스로 설명하는 내용을 주석으로 반복. 주석은 "왜"가 비자명할 때만 (숨은 제약·workaround·놀라운 동작).
- DO NOT `Co-Authored-By:` 형식의 트레일러를 커밋 메시지에 포함하지 말 것.

## axhub.ts 신뢰 모델 (1-line)

이 (Next.js) 템플릿은 **server-side**. axhub 헬퍼 = `axhub.fetch/data/slug/isConfigured` (6개 템플릿 동일 외부 API).
Transport: `Authorization: Bearer ${process.env.APPHUB_API_KEY}` from server. 풀 비교 표는 [examples README](../README.md#axhubts-신뢰-모델-모든-템플릿) 참고.

## Meta 앱 BYOA (Bring Your Own App)

납품 모델 — 각 고객사가 자기 Meta 앱을 직접 소유. AdFlow 는 자격증명을 env 또는 마법사로 받아요.

- 자격증명 저장: `lib/meta-credentials.ts` (server-side only). 우선순위: 로컬 암호화 파일(`.adflow/`) > `META_CLIENT_ID/SECRET` env 폴백.
- 마법사 진입점: `/install` (Phase A: 즉시 셋업, Phase B: App Review). 자격증명 없으면 `middleware.ts` 가 강제 리디렉트.
- 권한: 첫 셋업은 누구나, 자격증명 교체·삭제는 팀장만. 변경 이력은 audit log 자동 기록.
- NextAuth: 14곳에서 import 하는 `authOptions` 는 정적(Facebook provider 없음, 세션 검증용). `app/api/auth/[...nextauth]/route.ts` 만 `getAuthOptionsForNextAuth()` 로 동적 빌드 — 자격증명 교체 시 5분 캐시 후 자동 반영.
- 향후: Axhub Data plane 스펙 확정되면 `lib/meta-credentials.ts` 에 어댑터 추가 (현재 로컬 파일 어댑터와 갈아끼우기).

## 배포

`/axhub:deploy` (Claude Code) 또는 `axhub deploy create --app <slug> --branch main`. 사용자 명시 요청 후에만.

## Pull Request body 형식

`gh pr create` body 는 아래 구조를 사용한다. `## Summary` 아래를 `[ 주제 ]` 섹션으로 그룹핑.

```
## Summary

[ 주제1 ]

- 세부 항목 1
- 세부 항목 2

[ 주제2 ]

- 세부 항목 1
- 세부 항목 2

## Test plan
- [ ] 확인 항목
```

- `[ 주제 ]` = 변경 도메인/컴포넌트 단위로 묶기 (예: `[ 댓글 관리 페이지 ]`, `[ comments lib ]`, `[ 사이드바 ]`).
- 항목은 간결하게, 완전한 문장 불필요.
- `--assignee @me` + type→라벨 자동 적용 (`feat`→`enhancement`, `fix`→`bug`, `docs`→`documentation`).

## Commit messages

형식: `type(scope): 한국어 설명`. 풀 템플릿은 [.gitmessage](./.gitmessage) (이미 `commit.template` 로 등록됨, `git commit` 시 자동 로드).

- type: `feat` / `fix` / `refactor` / `style` / `test` / `docs` / `chore`.
- scope (선택): 변경 도메인 — `instagram`, `campaigns`, `launch-step`, `ui`, `billing` 등.
- 여러 항목 = `·`, 서브 설명 = `—`.
- 본문/푸터에 `Co-Authored-By:` 트레일러 금지 (위 §"절대 규칙" 참고).
- 예시:
  - `feat(campaigns): Edit Campaign 인라인 모달 4종 구현`
  - `feat(ab-test): 헤드라인 후보 선택 · AI 생성 패널 — STEP 02 연동`

## Testing

회귀 안전망 목적의 단위 테스트만. 자세한 결정은 [ADR-002](./.document/adr/ADR-002-testing-strategy.md).

- 도구: Vitest. 위치: co-located `*.test.ts` (모듈 옆).
- 스킬 정렬: **외부 인터페이스만** 테스트. internal seam (file-local 함수) 은 export 하지 말고 외부 인터페이스 + fetch/IO stub 으로 우회 검증.
- 새 deep module / pure fn 추출 시 — `*.test.ts` 후보를 같이 제안. 판단 기준: 조건 분기 ≥2 / 외부 입력→내부 결정 매핑 / 한 줄 setter 아님 — 셋 중 둘 이상이면 권장.
- `npm test` 는 사용자가 의식적으로 실행. AI 는 묻기 전 자동 실행 금지 (위 §"DO NOT 빌드/타입/린트" 와 동일).

## Agent skills

### Issue tracker

이슈는 `.scratch/<feature>/` 아래 로컬 마크다운 파일로 관리해요. `.document/agents/issue-tracker.md` 참고.

### Triage labels

기본 라벨 사용 (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). `.document/agents/triage-labels.md` 참고.

### Domain docs

단일 컨텍스트: 루트에 `CONTEXT.md` + `.document/adr/` 하나. `.document/agents/domain.md` 참고.
