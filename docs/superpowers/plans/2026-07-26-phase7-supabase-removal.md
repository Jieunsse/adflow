# 단계 7 — Supabase 제거 (사후 기록)

**Goal:** Supabase 의존을 완전히 걷어낸다. 설계 §9 의 마지막 단계.

## 먼저 확인한 것 — 옮길 데이터가 없다

설계는 이 단계의 절반을 **ETL** 로 잡았다. Node 스크립트가 Supabase 에서 읽어 Spring 엔드포인트로
POST 하고, 스토리지 파일은 "기존 프로젝트를 살려둔 상태에서" 받아온다는 계획이었다.

지우기 전에 실제 데이터를 세어보려다 알게 됐다 — **Supabase 프로젝트가 이미 없다.**

```
$ nslookup ypdbfmuiognbgddximdz.supabase.co
** server can't find …: NXDOMAIN        (8.8.8.8 로도 동일. supabase.com 은 정상 해석)
```

호스트 자체가 사라졌으므로 읽어올 원본이 없다. ETL 은 쓸 대상이 없어 만들지 않았다. 같은 이유로
설계 §10 의 부채 **"Owner Key 3종 혼재 — 단계 7 ETL 에서 실측 후 매핑 또는 폐기"** 도 자연 소멸했다.
매핑할 행이 없다.

스토리지 파일도 마찬가지다. 설계가 경고한 "소스가 살아 있어야 받을 수 있다"는 창은 이미 닫혔다.
`image_url` 이 옛 Supabase public URL 을 가리키는 행이 어딘가 남아 있다면 그건 죽은 링크다 —
`toPublicUrl` 은 절대 URL 을 그대로 통과시키므로 화면이 깨지지는 않고 이미지만 안 뜬다.

## 실제로 한 일

**남아 있던 Supabase 의존은 하나뿐이었다.** 단계 2~6 이 나머지를 이미 옮겼다.

### 1. `notion_connections` → Spring (ADR-043, 단계 4 에서 유예)

- `NotionConnection` 엔티티 + `/internal/notion-connections` (GET·POST·DELETE)
- 액세스 토큰은 **암호화 컬럼**이다. Supabase 시절엔 평문이었다 — MetaConnection 과 같은 처방.
- JWT 가 아니라 내부 시크릿으로 지킨다. Notion OAuth 콜백은 Spring JWT 를 들고 오지 않는다.
- 연결이 없으면 **204** 다. 404 로 두면 호출자가 "아직 연결 안 함"과 "고장"을 구분하지 못한다.

### 2. Supabase 흔적 제거

- `supabase-server.ts` 삭제 (마지막 `createClient` 호출부)
- `@supabase/supabase-js` 의존성 제거
- `.env.local` 의 `NEXT_PUBLIC_SUPABASE_*` 제거
- `supabase/` 디렉터리 삭제 (`schema.sql` · `pg-cron.sql` · `migrate-to-new-project.md`).
  **git 이력에 남아 있다** — 이제 존재하지 않는 시스템의 스키마라 레포에 두면 혼동만 준다.
- README 의 스키마 링크를 `apps/api` 로 바꿨다. 스키마의 단일 소스는 JPA 엔티티다(`ddl-auto`, 로컬 전용).
- 현재를 잘못 설명하던 주석 14곳 정정("Supabase=source-of-truth" → "서버=source-of-truth" 등).
  단계별 이력 주석("단계 4 에서 걷어냈다")은 그대로 뒀다.

### 3. 덤으로 잡은 것 — 낡은 lockfile

`apps/web/package-lock.json` 이 단계 0 의 모노레포 이동 이후 한 번도 갱신되지 않았다. 루트
lockfile 보다 23개 패키지 뒤처져 있었고, **방금 지운 `@supabase/supabase-js` 를 아직 물고 있었다.**

npm workspace 에서 권위 있는 것은 루트 lockfile 하나다. 중첩 lockfile 은 드리프트만 쌓이고, 낡은
채로 남으면 지워진 의존성을 되살릴 수 있어 지웠다. **Vercel Root Directory 미해결 건과 닿는 부분이라
아래 §확인 필요에 적어둔다.**

## 실측

| 검증 | 결과 |
|---|---|
| `./gradlew test` | **511건** green (504 → 511) |
| `./gradlew integrationTest` | **27건** green (26 → 27), 실제 PostgreSQL 16 |
| `npm test` | **1102건 / 78파일** green (1097 / 77) |
| `tsc --noEmit` · `npm run build` | 에러 0 · 성공 |
| 라이브 스모크 | 연결 없음 204 → 저장 → 조회(평문) → 시크릿 없이 401. DB 컬럼은 암호문 확인 |

## 남은 것

| 항목 | 상태 |
|---|---|
| Flyway 미도입 | 여전히 `ddl-auto`. 설계 §10 대로 **배포 결정 시점에 필수**다 |
| 엔진 이중화 (TS·Java) | 의도된 상태. 둘러보기가 TS 엔진을 쓴다. 골든 픽스처가 방어 |
| Vercel Root Directory | 단계 0 이후 미해결 |
| 실 Meta 게재·조회 검증 | 계정이 없어 여전히 미확인 (단계 6 기록 참고) |

## 확인 필요

**`apps/web/package-lock.json` 을 지운 것이 Vercel 배포에 영향을 주는지.** npm workspace 는 루트
lockfile 을 쓰고 Vercel 도 보통 워크스페이스 루트를 찾아 올라가지만, Root Directory 설정이 아직
미해결이라 실제 빌드로 확인해봐야 한다. 문제가 되면 `git revert` 로 되살릴 수 있다.
