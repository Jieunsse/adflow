# axhub 플러그인 SKILL QA 리포트

- **검수 일자**: 2026-05-13
- **플러그인 버전**: 0.5.7
- **CLI 버전**: 0.11.0
- **helper 버전**: 0.5.7
- **검수자**: jayden@jocodingax.ai
- **검수 범위**: 신규 추가 4개 SKILL (routing-stats / trace / verify / install-cli)

---

## 검수 배경

플러그인 0.5.7 업데이트로 기존 17개 SKILL에 4개가 신규 추가됨.
기존 17개는 doctor 진단으로 정상 확인. 신규 4개에 대해 의도적 에러 케이스를 설계하고 helper CLI 직접 호출로 동작 검증.

### 환경 진단 (doctor) 결과

```
✓ helper 바이너리:   정상 (cache-scan: ~/.claude/plugins/cache/axhub/axhub/0.5.7/bin/axhub-helpers)
✓ CLI 설치:          v0.11.0 (/opt/homebrew/bin/axhub)
✓ 버전 범위:         호환 (in_range: true)
✓ 로그인:            jayden@jocodingax.ai
✓ 만료:              20시간 9분 (2026-05-14T04:20:28Z)
✓ 권한 (scope):      read, write
✓ 환경 (profile):    default (기본값)
✓ endpoint:          https://hub-api.jocodingax.ai (기본값)
✓ 현재 앱:           adflow (last deploy #547 — active)
✓ deploy-events:     0 bytes (임계값 100 MB 미만, 정상)
```

---

## 버그 우선순위 총괄

| 심각도 | SKILL | 내용 |
|---|---|---|
| 🔴 Critical | **verify** | `axhub status` vs `axhub deploy status` API 불일치 — 항상 suspect 반환, SKILL 동작 불가 |
| 🔴 High | **trace** | `list-deployments` fallback에 `--app-id` 누락 → exit 64 |
| 🔴 High | **trace** | 존재하지 않는 deploy_id가 유효 deploy와 동일 빈 JSON 반환 — 404 감지 불가 |
| ⚠️ Medium | **trace** | active(실패 안 한) deploy 추적 시 처리 분기 명세 없음 |
| ⚠️ Medium | **install-cli** | brew install이 race check 통과 후 upgrade로 작동 — NEVER 규칙 충돌 가능 |
| ⚠️ Low | **routing-stats** | `confused_prompts:[]` 빈 배열 처리 명세 없음 |

---

## SKILL별 상세 결과

### 1. routing-stats

**테스트 명령어**:
```bash
HELPER=~/.claude/plugins/cache/axhub/axhub/0.5.7/bin/axhub-helpers

# [A] audit 비활성
AXHUB_NO_AUDIT=1 $HELPER routing-stats --since 7d --json

# [B] 정상 호출
$HELPER routing-stats --since 7d --json

# [C] confused 필터
$HELPER routing-stats --confused --json
```

**결과**:

| 케이스 | 입력 | helper 응답 | 판정 |
|---|---|---|---|
| audit 비활성 | `AXHUB_NO_AUDIT=1` | `{"audit_disabled":true,"message":"..."}` | ✅ 정상 |
| 정상 데이터 | `--since 7d` | 20 prompts, axhub_related 2건(10%), cli_versions {"0.11.0":20} | ✅ 정상 |
| confused 빈 배열 | `--confused` | `{"confused_prompts":[],"records":[],"total_prompts":0}` | ⚠️ 약점 |

**[A] audit 비활성 (✅)**
- `audit_disabled:true` + message 반환 — SKILL이 해당 필드를 감지해 "audit log가 비활성이에요" 안내 후 종료하면 정상

**[B] 정상 데이터 (✅)**
- 실제 audit 데이터 존재. SKILL이 `total_prompts / axhub_related_rate / prompt_length_p50/p95 / cli_versions / top_axhub_hashes` 추출해서 Korean narrative로 렌더링 가능한 형태

**[C] confused 빈 배열 (⚠️)**
- `confused_prompts:[]`, `total_prompts:0` 반환
- SKILL.md Step 2에 "상위 axhub 관련 prompt hash가 있으면(~5개) 추가해요. 없으면 생략해요"는 있으나 `confused_prompts` 빈 배열 처리 명세 없음
- 빈 배열 그대로 출력하거나 "confused 없음" 안내 필요 — 명세 보완 권고

---

### 2. trace

**테스트 명령어**:
```bash
HELPER=~/.claude/plugins/cache/axhub/axhub/0.5.7/bin/axhub-helpers

# [A] list-deployments (--app-id 없이)
$HELPER list-deployments --limit 5 --json

# [B] 유효 active deploy
$HELPER trace --deploy-id=547 --json

# [C] 존재하지 않는 deploy_id
$HELPER trace --deploy-id=99999999 --json

# [D] deploy_id 없이
$HELPER trace --json
```

**결과**:

| 케이스 | 입력 | helper 응답 | 판정 |
|---|---|---|---|
| list-deployments fallback | `--limit 5 --json` | `exit 64: --app-id is required` | 🔴 버그 |
| 유효 active deploy (547) | `--deploy-id=547` | `failure_reason:null, matched_patterns:[]` | ⚠️ 약점 |
| 존재하지 않는 ID (99999999) | `--deploy-id=99999999` | **[B]와 동일한 빈 JSON** | 🔴 버그 |
| deploy_id 없이 | `--json` | `--deploy-id required` | ℹ️ 정상 |

**[A] list-deployments --app-id 누락 (🔴)**
- SKILL.md Step 1: "없으면 `axhub-helpers list-deployments --limit 5 --json`에서 마지막 Failed entry 추출"
- 실제 helper: `--app-id` 필수 파라미터. **SKILL.md와 helper API 불일치**
- 영향: preflight에 `last_deploy_id`가 없을 때(최초 사용자, 배포 이력 없음) fallback 경로 전체 실패
- 수정 방안: SKILL.md Step 1을 `axhub-helpers list-deployments --app-id=$CURRENT_APP --limit 5 --json`으로 수정 (preflight의 `current_app` 활용)

**[C] 404 감지 불가 (🔴)**
- `deploy_id=99999999` (서버에 없는 ID) → `{"failure_reason":null,"matched_patterns":[],"phase_durations":[],"build_log_errors":[]}` 반환
- `deploy_id=547` (유효 active) → **동일한 구조**
- SKILL이 "실패 배포 없음"과 "존재하지 않는 배포"를 구분할 수 없음
- 수정 방안: helper가 404 시 `{"error":"not_found","deploy_id":"..."}` 또는 exit 65 반환하도록 수정

**[B] active deploy 처리 분기 없음 (⚠️)**
- 실패하지 않은 배포(failure_reason:null)를 추적했을 때 SKILL.md에 처리 분기 없음
- "이 배포는 실패하지 않았어요" 안내 없이 빈 empathy card가 출력될 가능성
- 수정 방안: SKILL.md에 `failure_reason:null` && `matched_patterns:[]` 시 "추적할 실패 없음" early-exit 분기 추가

---

### 3. verify

**테스트 명령어**:
```bash
HELPER=~/.claude/plugins/cache/axhub/axhub/0.5.7/bin/axhub-helpers

# [A] --app-id 없이
$HELPER verify --json

# [B] 유효 앱 (adflow id=175)
$HELPER verify --app-id=175 --json

# [C] 존재하지 않는 앱
$HELPER verify --app-id=nonexistent-app-xyz --json

# [D] 실제 axhub deploy status 확인
axhub deploy status 547 --json
```

**결과**:

| 케이스 | 입력 | helper 응답 | 판정 |
|---|---|---|---|
| --app-id 없이 | `verify --json` | `app-id required` | ⚠️ SKILL.md 미명시 |
| 유효 앱 (adflow) | `--app-id=175` | `verdict:"suspect"` (reasons: axhub status exit 64, state 필드 부재, axhub logs exit 64) | 🔴 Critical 버그 |
| 존재하지 않는 앱 | `--app-id=nonexistent-xyz` | `verdict:"suspect"` (동일 이유) | 🔴 유효/무효 구분 불가 |

**[B] API 불일치 — 핵심 버그 (🔴 Critical)**

helper가 내부에서 `axhub status`를 호출하는데, 이 명령어는 인증·프로필 정보를 반환:
```json
// axhub status 실제 반환값
{"profile":"default","logged_in":true,"user_email":"jayden@jocodingax.ai","apps_count":7,...}
```

helper는 여기서 `state` 필드를 찾으려 하지만 존재하지 않아 exit 64 발생.

실제 배포 상태 확인에 필요한 명령어:
```bash
axhub deploy status 547 --json
# → {"id":547,"status_name":"stopped","branch":"main","commit_sha":"..."}
```

| 명령어 | 반환 필드 | verify에 필요한가 |
|---|---|---|
| `axhub status` | profile, logged_in, apps_count | ❌ (인증 정보) |
| `axhub deploy status <id>` | status_name, id, branch | ✅ (배포 상태) |

- **영향**: 현재 verify SKILL은 유효한 앱이든 없는 앱이든 항상 `verdict:"suspect"` 반환. SKILL 동작 불가 상태.
- **수정 방안**: helper의 verify 구현에서 `axhub status` → `axhub deploy status <deploy_id>` 교체, `state` 필드 → `status_name` 필드 기준으로 verdict 로직 수정. 판정 기준: `status_name in ["active","running","succeeded"]` → ✅ 라이브.

---

### 4. install-cli

**테스트 명령어**:
```bash
# [A] race check
axhub --version && echo "EXIT:0 → Step 6 skip"

# [B] OS 감지
uname -s

# [C] Homebrew 존재
command -v brew && brew --version | head -1

# [D] 공식 installer URL
curl -sIo /dev/null -w "%{http_code}" https://cli.jocodingax.ai/install.sh

# [E] brew install (이미 설치 상태)
brew install jocoding-ax-partners/tap/axhub 2>&1 | head -5
```

**결과**:

| 케이스 | 결과 | 판정 |
|---|---|---|
| race check (CLI 이미 설치) | exit 0 → Step 6 skip 정상 | ✅ 정상 |
| OS 감지 | Darwin → macOS 분기 | ✅ 정상 |
| Homebrew 존재 | brew 5.1.9, tap `jocoding-ax-partners/tap` 유효 | ✅ 정상 |
| 공식 installer URL | HTTP 200 | ✅ 정상 |
| brew install (outdated) | **"0.11.0 is already installed but outdated → upgrading to 0.12.1"** | ⚠️ 약점 |

**[E] brew upgrade 부작용 (⚠️)**
- SKILL.md NEVER 규칙: "NEVER pre-existing CLI 덮어쓰기. Step 2 race check 필수"
- race check(Step 2)는 정상 작동하지만, 사용자가 brew 채널을 선택하고 race check를 어떤 이유로 통과 못한 경우 `brew install`이 자동으로 `brew upgrade`로 동작해 기존 버전을 덮어씀
- 실제 brew 업그레이드 시작 확인 (head -5 파이프로 중단, 현재 버전 0.11.0 유지)
- 수정 방안: brew 채널 선택 시 `brew install` 대신 `brew upgrade` 명시 또는 `brew list axhub` 사전 확인 후 이미 설치면 "이미 설치됨" 안내로 분기

---

## 신규 SKILL 4개 전체 판정

| SKILL | 핵심 기능 동작 | 에러 처리 | 종합 |
|---|---|---|---|
| routing-stats | ✅ 정상 | ⚠️ confused 빈 배열 명세 보완 필요 | 배포 가능 (minor 보완) |
| trace | ✅ 정상 경로 | 🔴 list-deployments 누락, 404 감지 불가 | 조건부 배포 (High 버그 수정 필요) |
| verify | ❌ 동작 불가 | 🔴 API 불일치로 항상 suspect | **릴리즈 블로커** |
| install-cli | ✅ 정상 (race check 유효) | ⚠️ brew upgrade 부작용 | 배포 가능 (medium 보완) |

---

## 권고 액션

1. **즉시 수정 (Critical)**: `axhub-helpers verify` 내부 구현에서 `axhub status` → `axhub deploy status <deploy_id>` 교체, `state` → `status_name` 필드 기준으로 verdict 로직 수정
2. **우선 수정 (High)**: `axhub-helpers list-deployments` 호출 시 `--app-id` 파라미터 추가 — SKILL.md Step 1 명세 수정 또는 helper 기본값 처리
3. **우선 수정 (High)**: trace helper가 존재하지 않는 deploy_id에 대해 구분 가능한 에러(exit 65 또는 `"error":"not_found"`) 반환하도록 수정
4. **명세 보완 (Medium)**: trace SKILL.md에 `failure_reason:null` && `matched_patterns:[]` early-exit 분기 추가
5. **명세 보완 (Medium)**: install-cli SKILL.md에 brew 채널 선택 시 기존 설치 버전 확인 스텝 추가
6. **명세 보완 (Low)**: routing-stats SKILL.md에 `confused_prompts:[]` 빈 배열 처리 명세 추가
