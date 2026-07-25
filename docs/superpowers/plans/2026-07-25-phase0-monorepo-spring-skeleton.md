# 단계 0 — 모노레포 재배치 + Spring 스켈레톤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 앱을 `apps/web` 으로 옮기고 `apps/api` 에 Spring Boot 스켈레톤과 Docker Postgres 를 세워, 이후 모든 단계의 토대를 만든다. 프론트 기능은 하나도 바뀌지 않는다.

**Architecture:** 루트를 npm workspace 로 만들고 Next.js 전체를 단위로 `apps/web` 에 이동한다. 모든 설정 파일이 자기 위치 기준 상대 경로(`./`·`__dirname`)를 쓰므로 통째로 옮기면 내부 경로는 그대로 유효하다. Spring Boot 은 Gradle 독립 프로젝트로 `apps/api` 에 두고 npm workspace 에는 넣지 않는다.

**Tech Stack:** Next.js 16 · React 19 · TypeScript strict · Vitest / JDK 21 (Temurin 21.0.10) · Spring Boot 3.5.x · Gradle Kotlin DSL · PostgreSQL 16 (Docker)

## Global Constraints

- 단계 0 종료 시 **로컬 앱은 Supabase 로 계속 동작해야 한다.** 프론트 기능 변경 0.
- **674 Vitest 테스트가 계속 green** 이어야 한다 (63 파일). 테스트를 고쳐서 통과시키지 말고 경로만 맞춘다.
- `npm run build` 가 계속 성공해야 한다.
- 배포 환경은 **둘러보기 전용**으로 강등한다. 실사용 경로는 로컬에서만 동작한다.
- 파일 이동은 **`git mv`** 로 한다. 히스토리를 잃지 않는다.
- 새 npm 패키지 설치는 사용자 확인을 받는다 (AGENTS.md 절대 규칙).
- 커밋 메시지는 `type(scope): 한국어 설명`. `Co-Authored-By:` 트레일러 금지.
- 커밋·푸시 전 `git branch --show-current` 로 브랜치를 확인한다 (현재 `dev`).

## 사람이 해야 하는 작업 (에이전트가 할 수 없음)

Task 2 완료 후 **Vercel 대시보드에서 Root Directory 를 `apps/web` 으로 변경**해야 배포 빌드가 복구된다. 이건 대시보드 설정이라 코드로 못 바꾼다. 이 설정 전까지 배포는 깨진 상태로 남는다 — 배포를 둘러보기 전용으로 강등하는 중이라 급하지 않지만, 방치하면 잊는다.

---

## File Structure

**이동 (git mv → `apps/web/`)**

| 대상 | 비고 |
|---|---|
| `app/` `src/` `lib/` `types/` `public/` `scripts/` `certificates/` | 소스 전부 |
| `next.config.ts` `tsconfig.json` `vitest.config.ts` | 상대경로라 무수정 |
| `eslint.config.mjs` `postcss.config.mjs` `tailwind.config.ts` | 무수정 |
| `package.json` `package-lock.json` | 워크스페이스 멤버가 됨 |
| `proxy.ts` `next-env.d.ts` | Next 16 proxy(구 middleware)는 앱 루트에 있어야 함 |
| `.env.local` `.env.example` | Next 는 자기 루트에서 로드 |

**루트 유지**

`AGENTS.md` `CLAUDE.md` `README.md` `docs/` `.document/` `supabase/` `vercel.json` `.github/` `.gitignore` `.gitmessage` `.editorconfig` · 에이전트 도구 디렉토리 · 미추적 로컬 디렉토리(`data/` `memory/` `.scratch/`)

**신규 생성**

| 경로 | 책임 |
|---|---|
| `package.json` (루트) | npm workspace 루트. 하위 스크립트 위임만 |
| `docker-compose.yml` | Postgres 16 단독 |
| `apps/api/` | Spring Boot 프로젝트 (Gradle) |
| `packages/contracts/package.json` | OpenAPI 스펙 + 생성 TS 타입의 집 |

**삭제**

`axhub.yaml` `apphub.yaml` (axhub 배포 매니페스트 잔여) · `pnpm-lock.yaml` (락파일 중복)

---

## Task 1: axhub 잔여 제거 + 락파일 단일화

앞선 axhub 정리(`4a60f78`)가 `*.yaml` 을 검사하지 않아 배포 매니페스트 2개가 남았다. 이동하기 전에 지워서 옮길 파일을 줄인다. 락파일 2개 공존은 워크스페이스 설정 전에 반드시 해소해야 한다.

**Files:**
- Delete: `axhub.yaml`, `apphub.yaml`, `pnpm-lock.yaml`
- Modify: `.gitignore:53-54` (axhub 항목 제거)
- Regenerate: `package-lock.json` (name 필드가 아직 `nextjs-axhub`)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: 없음. 순수 정리 작업

- [ ] **Step 1: 잔여 파일이 실제로 무엇을 참조하는지 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git ls-files -z | xargs -0 grep -ril "axhub\|apphub" 2>/dev/null
```

기대 출력 — 정확히 5줄:
```
.gitignore
apphub.yaml
axhub.yaml
docs/superpowers/specs/2026-07-25-spring-backend-migration-design.md
package-lock.json
```

설계 문서의 언급은 히스토리 기술이라 그대로 둔다. 나머지 4개가 이 작업 대상이다.

- [ ] **Step 2: 매니페스트와 중복 락파일 삭제**

```bash
git rm axhub.yaml apphub.yaml pnpm-lock.yaml
rm -rf .axhub-state
```

`pnpm-lock.yaml` 을 지우고 npm 을 유일한 패키지 매니저로 확정한다. 근거: `npm test`·`npm run build` 가 현재 성공하며 `npm -v` 는 11.8.0. pnpm 은 실제로 쓰이지 않는다.

- [ ] **Step 3: `.gitignore` 의 axhub 항목 제거**

53~54번 줄을 삭제한다.

```
# axhub quality state (local-only)
.axhub-state/
```

- [ ] **Step 4: package-lock 재생성으로 옛 패키지명 제거**

```bash
npm install
grep -c "nextjs-axhub" package-lock.json
```

기대: `0`

- [ ] **Step 5: 회귀 확인**

```bash
npx tsc --noEmit && npm test -- --run && npm run build
```

기대: tsc 에러 0 · `Test Files 63 passed / Tests 674 passed` · build 성공

- [ ] **Step 6: 잔여 0건 재확인**

```bash
git ls-files -z | xargs -0 grep -ril "axhub\|apphub" 2>/dev/null
```

기대: 설계 문서 1줄만 출력

- [ ] **Step 7: 커밋**

```bash
git branch --show-current   # dev 확인
git add -A
git commit -m "chore(axhub): 배포 매니페스트 잔여 제거 · pnpm-lock 삭제로 패키지 매니저 npm 단일화"
```

---

## Task 2: Next.js 를 `apps/web` 으로 이동 + npm workspace

이 계획의 핵심 작업이다. 설정 파일이 전부 자기 위치 기준 상대 경로를 쓰므로 통째로 옮기면 내부 경로는 유효하다. 깨지는 것은 루트 앵커 `.gitignore` 항목과 워크스페이스 배선뿐이다.

**Files:**
- Move: 위 File Structure 의 "이동" 표 전체 → `apps/web/`
- Create: `package.json` (루트, 워크스페이스)
- Modify: `.gitignore` (루트 앵커 경로 해제)

**Interfaces:**
- Consumes: Task 1 의 정리된 트리
- Produces: `apps/web/` 경로. 이후 모든 프론트 작업의 기준. 루트에서 `npm run dev|build|test|lint` 가 `apps/web` 으로 위임된다.

- [ ] **Step 1: 이동 전 기준선 기록**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
```

기대: `Test Files 63 passed (63)` / `Tests 674 passed (674)`

이 숫자를 이동 후와 대조한다. 다르면 이동이 뭔가를 깨뜨린 것이다.

- [ ] **Step 2: 디렉토리 생성**

```bash
mkdir -p apps/web packages/contracts
```

- [ ] **Step 3: `git mv` 로 소스·설정 이동**

```bash
git mv app src lib types public scripts certificates apps/web/
git mv next.config.ts tsconfig.json vitest.config.ts apps/web/
git mv eslint.config.mjs postcss.config.mjs tailwind.config.ts apps/web/
git mv package.json package-lock.json apps/web/
git mv proxy.ts apps/web/
```

`next-env.d.ts` 와 `.env*` 는 gitignore 대상이라 `git mv` 가 안 된다. 일반 `mv` 로 옮긴다.

```bash
mv next-env.d.ts .env.local .env.example apps/web/ 2>/dev/null
mv tsconfig.tsbuildinfo apps/web/ 2>/dev/null || true
```

- [ ] **Step 4: 루트 워크스페이스 `package.json` 생성**

`apps/api` 는 Gradle 프로젝트라 workspaces 에 넣지 않는다.

```json
{
  "name": "adflow-monorepo",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/web",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace apps/web",
    "https-dev": "npm run https-dev --workspace apps/web",
    "build": "npm run build --workspace apps/web",
    "start": "npm run start --workspace apps/web",
    "lint": "npm run lint --workspace apps/web",
    "test": "npm run test --workspace apps/web"
  }
}
```

- [ ] **Step 5: `packages/contracts` 최소 스캐폴드**

워크스페이스 glob `packages/*` 이 빈 디렉토리를 만나면 npm install 이 실패한다. 자리만 잡아둔다.

`packages/contracts/package.json`:

```json
{
  "name": "@adflow/contracts",
  "version": "0.0.0",
  "private": true,
  "description": "OpenAPI 스펙과 생성된 TypeScript 타입 · 엔진 동등성 검증용 골든 픽스처"
}
```

- [ ] **Step 6: `.gitignore` 루트 앵커 해제**

이동으로 빌드 산출물이 `apps/web/` 아래로 내려갔다. 선행 `/` 를 떼어 어느 깊이에서도 매칭되게 한다.

변경할 줄:

```
# dependencies
node_modules

# testing
coverage

# next.js
.next/
out/

# production
build
```

`/public/uploads/` 도 경로가 바뀌었다:

```
# /posts 업로드 — IG Graph 가 가져갈 임시 호스팅
public/uploads/
```

`/data/` 는 dev 서버 cwd 가 `apps/web` 이 되면서 위치가 바뀐다:

```
# local state store cache
data/
```

`.env*` `next-env.d.ts` `certificates` `*.tsbuildinfo` 는 이미 앵커가 없어 수정 불필요.

- [ ] **Step 7: 의존성 재설치 (워크스페이스 링크 생성)**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
rm -rf node_modules apps/web/node_modules
npm install
```

기대: 루트에 `node_modules` 가 생기고 `apps/web` 은 호이스팅으로 해결됨. 에러 없이 종료.

- [ ] **Step 8: 테스트가 이동 후에도 같은 수로 통과하는지 확인**

```bash
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
```

기대: Step 1 과 **정확히 동일한** `63 passed` / `674 passed`

숫자가 줄었다면 vitest 가 테스트 파일을 못 찾는 것이다. `apps/web/vitest.config.ts` 의 `include` 가 `["src/**/*.test.ts", "lib/**/*.test.ts"]` 이고 `__dirname` 이 `apps/web` 이므로 그대로 맞아야 한다.

- [ ] **Step 9: 타입체크와 빌드 확인**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json
npm run build
```

기대: tsc 에러 0 · build 성공 · 라우트 목록이 이동 전과 동일

- [ ] **Step 10: dev 서버 기동 확인**

```bash
npm run dev
```

`http://localhost:3000` 이 뜨는지 확인하고 종료한다. Supabase 환경변수가 `apps/web/.env.local` 로 따라왔으므로 데이터 기능도 이동 전과 같이 동작해야 한다.

- [ ] **Step 11: 커밋**

```bash
git branch --show-current
git add -A
git commit -m "refactor(monorepo): Next.js 를 apps/web 으로 이동 · 루트를 npm workspace 로 전환"
```

- [ ] **Step 12: Vercel Root Directory 변경을 사용자에게 요청**

에이전트가 할 수 없는 작업이다. Vercel 대시보드 → 프로젝트 → Settings → General → Root Directory 를 `apps/web` 으로 바꿔야 배포 빌드가 복구된다. 사용자에게 명시적으로 알리고 넘어간다.

---

## Task 3: Docker Postgres

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: 없음
- Produces: `localhost:5432` 의 `adflow` 데이터베이스. 접속 정보 — user `adflow` / password `adflow` / db `adflow`. Task 4 의 Spring `application.yml` 이 이 값을 참조한다.

- [ ] **Step 1: `docker-compose.yml` 작성**

로컬 전용이라 비밀번호를 파일에 둔다. 배포 대상이 아니므로 시크릿 관리 부담이 없다.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: adflow-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: adflow
      POSTGRES_PASSWORD: adflow
      POSTGRES_DB: adflow
    ports:
      - "5432:5432"
    volumes:
      - adflow-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U adflow -d adflow"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  adflow-pgdata:
```

bind mount(`./.docker/postgres`) 가 아니라 **named volume 을 쓴다.** macOS 에서 Postgres 데이터 디렉토리를 호스트 파일시스템에 바인드하면 권한·성능 문제가 잦다. named volume 은 그 문제가 없고 `.gitignore` 도 손댈 필요가 없다.

데이터를 완전히 지우고 다시 시작하려면:

```bash
docker compose down -v
```

- [ ] **Step 2: 이 단계에서 `.gitignore` 수정은 없다**

named volume 을 쓰므로 저장소에 생기는 파일이 없다. 다음 단계로 넘어간다.

- [ ] **Step 3: 기동과 헬스체크 확인**

```bash
docker compose up -d postgres
docker compose ps
```

기대: `adflow-postgres` 가 `healthy` 상태

- [ ] **Step 4: 접속 확인**

```bash
docker compose exec postgres psql -U adflow -d adflow -c "select version();"
```

기대: PostgreSQL 16.x 버전 문자열 출력

- [ ] **Step 5: 커밋**

```bash
git add docker-compose.yml
git commit -m "feat(infra): 로컬 개발용 Docker Postgres 16 추가"
```

---

## Task 4: Spring Boot 스켈레톤

**Files:**
- Create: `apps/api/` (Spring Initializr 산출물 — `gradlew` 포함)
- Create: `apps/api/src/main/resources/application.yml`
- Create: `apps/api/src/test/java/ai/adflow/api/HealthEndpointTest.java`
- Modify: `apps/api/build.gradle.kts` (springdoc 추가)
- Modify: `.gitignore` (Gradle 산출물)

**Interfaces:**
- Consumes: Task 3 의 Postgres (`localhost:5432`, adflow/adflow/adflow)
- Produces: `apps/api` Gradle 프로젝트. 패키지 루트 `ai.adflow.api`. `GET /actuator/health` 가 `{"status":"UP"}` 반환. `./gradlew :bootRun` 으로 기동. OpenAPI 스펙이 `/v3/api-docs` 에 노출된다 — Task 5 가 이 경로를 소비한다.

- [ ] **Step 1: Gradle 이 없으므로 Initializr 로 wrapper 포함 프로젝트를 받는다**

로컬에 `gradle`·`mvn` 이 없다(`which gradle mvn` → 없음). `gradle wrapper` 를 쓸 수 없으므로 Initializr 가 생성한 wrapper 를 쓴다. `bootVersion` 은 지정하지 않아 현재 안정 최신을 받는다 — 존재하지 않는 버전을 하드코딩해 실패하는 것을 피한다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta
curl -sS https://start.spring.io/starter.zip \
  -d type=gradle-project-kotlin \
  -d language=java \
  -d javaVersion=21 \
  -d groupId=ai.adflow \
  -d artifactId=api \
  -d name=api \
  -d packageName=ai.adflow.api \
  -d dependencies=web,actuator,data-jpa,postgresql,validation \
  -o /tmp/adflow-api.zip
unzip -q /tmp/adflow-api.zip -d apps/
```

- [ ] **Step 2: 받은 Spring Boot 버전을 확인하고 기록**

```bash
grep "id(\"org.springframework.boot\")" apps/api/build.gradle.kts
java -version 2>&1 | head -1
```

기대: Spring Boot 3.5.x · `openjdk version "21.0.10"`

3.5.x 가 아니면 설계 문서(`Spring Boot 3.5.x`)와 어긋난다. 그때는 사용자에게 알리고 판단을 받는다 — 임의로 다운그레이드하지 않는다.

- [ ] **Step 3: `build.gradle.kts` 에 springdoc 추가**

OpenAPI 스펙 생성은 Initializr 목록에 없어 직접 넣는다. `dependencies` 블록에 추가한다.

```kotlin
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.5")
```

새 의존성 추가이므로 진행 전 사용자 확인을 받는다 (AGENTS.md 절대 규칙 — npm 패키지에 준해 적용).

버전을 확인한다. Step 2 에서 받은 Spring Boot 버전과 호환되는 springdoc 이어야 한다.

```bash
cd apps/api && ./gradlew dependencies --configuration runtimeClasspath 2>&1 | grep -i springdoc
```

의존성 해석이 실패하면 (`Could not find org.springdoc:...`) 버전을 하드코딩하지 말고 실제 최신 릴리스를 확인해서 맞춘다.

```bash
curl -sS "https://search.maven.org/solrsearch/select?q=g:org.springdoc+AND+a:springdoc-openapi-starter-webmvc-ui&rows=5&core=gav&wt=json" \
  | grep -o '"v":"[^"]*"' | head -5
```

출력된 최신 버전으로 `build.gradle.kts` 를 고치고 다시 해석한다.

- [ ] **Step 4: `application.yml` 작성**

Initializr 가 만든 `application.properties` 를 지우고 yml 로 바꾼다. 설계 §6 의 `app.poller.interval` 자리를 지금 잡아둔다 — 나중에 찾아 헤매지 않게.

```bash
rm apps/api/src/main/resources/application.properties
```

`apps/api/src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: adflow-api
  datasource:
    url: jdbc:postgresql://localhost:5432/adflow
    username: adflow
    password: adflow
  jpa:
    hibernate:
      # 로컬 전용. 배포를 결정하면 Flyway 로 교체해야 한다 (설계 §10 부채).
      ddl-auto: update
    open-in-view: false
    properties:
      hibernate:
        format_sql: true

management:
  endpoints:
    web:
      exposure:
        include: health, info

app:
  poller:
    # 운영 기본값 6시간. 로컬 프로필에서 짧게 덮어쓴다 (설계 §6).
    interval: PT6H

---
spring:
  config:
    activate:
      on-profile: local
app:
  poller:
    interval: PT1M
```

- [ ] **Step 5: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/HealthEndpointTest.java`:

```java
package ai.adflow.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthEndpointTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void healthEndpointReportsUp() throws Exception {
    mockMvc
        .perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
  }
}
```

- [ ] **Step 6: 테스트가 실패하는 것을 확인**

```bash
cd apps/api && ./gradlew test
```

기대: FAIL. `test` 프로필용 데이터소스가 없어 `ApplicationContext` 로딩이 실패한다. Postgres 에 의존하지 않는 테스트 설정이 필요하다는 것을 이 실패가 알려준다.

- [ ] **Step 7: 테스트 프로필에 인메모리 데이터소스를 붙인다**

Postgres 를 띄우지 않고도 컨텍스트가 로딩되게 H2 를 테스트 스코프로 넣는다. `apps/api/build.gradle.kts` 의 `dependencies` 블록에 추가한다.

```kotlin
    testRuntimeOnly("com.h2database:h2")
```

`apps/api/src/test/resources/application-test.yml`:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:adflow;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: create-drop
```

H2 는 스켈레톤 단계의 컨텍스트 로딩용이다. 실제 스키마 검증은 설계 §8 대로 Testcontainers 로 하며, 그건 엔티티가 생기는 단계 2 에서 도입한다.

- [ ] **Step 8: 테스트가 통과하는 것을 확인**

```bash
cd apps/api && ./gradlew test
```

기대: PASS. `HealthEndpointTest > healthEndpointReportsUp() PASSED`

- [ ] **Step 9: Postgres 를 붙여 실제 기동 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose up -d postgres
cd apps/api && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 25
curl -sS http://localhost:8080/actuator/health
curl -sS http://localhost:8080/v3/api-docs | head -c 200
```

기대: `{"status":"UP"}` · api-docs 가 OpenAPI JSON 을 반환 (`{"openapi":"3.`…)

확인 후 `bootRun` 프로세스를 종료한다.

- [ ] **Step 10: Gradle 산출물을 gitignore 에 추가**

`.gitignore` 끝에 추가:

```
# Gradle / Spring Boot
apps/api/build/
apps/api/.gradle/
```

`gradlew`·`gradle/wrapper/` 는 **커밋한다** — wrapper 가 없으면 다른 환경에서 빌드할 수 없다.

- [ ] **Step 11: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git branch --show-current
git add apps/api .gitignore
git commit -m "feat(api): Spring Boot 스켈레톤 추가 — actuator health · springdoc · Postgres 연결"
```

---

## Task 5: OpenAPI → TypeScript 타입 생성 배선

설계의 계약 규칙(§3)을 지금 배선한다. 엔드포인트가 없어도 파이프라인이 돌아야, 단계 2 에서 첫 엔드포인트를 만들 때 타입이 자동으로 따라온다.

**Files:**
- Create: `packages/contracts/generate.sh`
- Modify: `packages/contracts/package.json` (생성 스크립트)
- Modify: `package.json` (루트, `contracts:generate` 위임)
- Modify: `.gitignore` (생성물 제외 여부)

**Interfaces:**
- Consumes: Task 4 의 `/v3/api-docs`
- Produces: `packages/contracts/openapi.json` (스펙 스냅샷) · `packages/contracts/types/api.d.ts` (생성 TS 타입). 단계 2 부터 프론트가 `@adflow/contracts` 로 import 한다.

- [ ] **Step 1: `openapi-typescript` 설치 확인을 받는다**

새 dev 의존성이므로 사용자 확인 후 진행한다.

```bash
npm install --save-dev --workspace packages/contracts openapi-typescript
```

- [ ] **Step 2: 생성 스크립트 작성**

`packages/contracts/generate.sh`:

```bash
#!/usr/bin/env bash
# Spring 이 떠 있어야 한다. 스펙을 스냅샷으로 떠서 TS 타입을 생성한다.
set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if ! curl -sSf "$API_URL/v3/api-docs" -o "$HERE/openapi.json"; then
  echo "Spring 이 $API_URL 에서 응답하지 않아요. ./gradlew :bootRun 으로 먼저 띄워주세요." >&2
  exit 1
fi

mkdir -p "$HERE/types"
npx openapi-typescript "$HERE/openapi.json" -o "$HERE/types/api.d.ts"
echo "생성 완료 — $HERE/types/api.d.ts"
```

```bash
chmod +x packages/contracts/generate.sh
```

- [ ] **Step 3: `packages/contracts/package.json` 에 스크립트 추가**

```json
{
  "name": "@adflow/contracts",
  "version": "0.0.0",
  "private": true,
  "description": "OpenAPI 스펙과 생성된 TypeScript 타입 · 엔진 동등성 검증용 골든 픽스처",
  "types": "./types/api.d.ts",
  "scripts": {
    "generate": "./generate.sh"
  },
  "devDependencies": {
    "openapi-typescript": "^7.0.0"
  }
}
```

`devDependencies` 의 버전은 Step 1 이 실제로 설치한 버전으로 맞춘다. 임의로 적지 말고 `npm ls openapi-typescript` 로 확인한 값을 쓴다.

- [ ] **Step 4: 루트에 위임 스크립트 추가**

루트 `package.json` 의 `scripts` 에 추가:

```json
    "contracts:generate": "npm run generate --workspace packages/contracts"
```

- [ ] **Step 5: 생성물이 커밋되는지 결정하고 반영**

`openapi.json` 과 `types/api.d.ts` 는 **커밋한다.** 프론트 컴파일이 이 타입에 의존하므로, 커밋하지 않으면 Spring 을 띄우지 않은 상태에서 `npm run build` 가 깨진다. 설계 §8 의 "생성 타입이 바뀌면 프론트 컴파일이 깨지게" 라는 드리프트 감지도 커밋된 산출물이 있어야 성립한다.

`.gitignore` 에 추가하지 않는다. 이 단계에서 `.gitignore` 수정은 없다.

- [ ] **Step 6: 파이프라인이 실제로 도는지 확인**

```bash
cd apps/api && ./gradlew bootRun --args='--spring.profiles.active=local' &
sleep 25
cd /Users/jieunsse/jieunsse/dev/meta
npm run contracts:generate
head -20 packages/contracts/types/api.d.ts
```

기대: `생성 완료` 메시지와 함께 `api.d.ts` 가 만들어짐. 엔드포인트가 없으니 `paths` 는 actuator 항목 정도만 있거나 비어 있다 — 정상이다. 파이프라인이 도는 것을 확인하는 게 목적이다.

확인 후 `bootRun` 을 종료한다.

- [ ] **Step 7: Spring 이 꺼진 상태에서 실패 메시지가 친절한지 확인**

```bash
npm run contracts:generate
```

기대: `Spring 이 http://localhost:8080 에서 응답하지 않아요. ./gradlew :bootRun 으로 먼저 띄워주세요.` 와 종료 코드 1

- [ ] **Step 8: 커밋**

```bash
git add packages/contracts package.json package-lock.json
git commit -m "feat(contracts): OpenAPI → TypeScript 타입 생성 파이프라인 배선"
```

---

## Task 6: 배포 강등 — 둘러보기 전용

배포 환경에서 Facebook provider 를 등록하지 않는다. 등록해두면 사용자가 로그인에 성공해 실사용 화면으로 들어갔는데 영속 레이어가 없는 상태가 된다. `vercel.json` 의 cron 도 제거한다 — 배포 환경에는 진행할 실 토너먼트가 없다.

**Files:**
- Modify: `apps/web/lib/auth.ts` (provider 등록 조건)
- Create: `apps/web/lib/auth.test.ts`
- Modify: `vercel.json` (crons 제거)
- Modify: `apps/web/.env.example` (플래그 문서화)

**Interfaces:**
- Consumes: 없음
- Produces: 환경변수 `ADFLOW_BROWSE_ONLY`. `"true"` 면 Facebook provider 를 등록하지 않고 게스트만 남긴다. 이후 단계에서 백엔드 클라이언트도 같은 플래그를 참조한다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`buildCommonOptions` 는 export 되지 않은 파일 내부 함수다. AGENTS.md 테스트 규칙대로 내부 seam 을 노출하지 않고 외부 인터페이스 `getAuthOptionsForNextAuth()` 로 검증한다. Meta 자격증명 캐시는 stub 한다.

`apps/web/lib/auth.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./meta-credentials", () => ({
  credentialsCache: {
    get: vi.fn(async () => ({ clientId: "test-id", clientSecret: "test-secret" })),
  },
}));

async function providerIds(): Promise<string[]> {
  vi.resetModules();
  const { getAuthOptionsForNextAuth } = await import("./auth");
  const options = await getAuthOptionsForNextAuth();
  return (options.providers ?? []).map((p) => (p as { id: string }).id);
}

describe("getAuthOptionsForNextAuth", () => {
  const original = process.env.ADFLOW_BROWSE_ONLY;

  beforeEach(() => {
    delete process.env.ADFLOW_BROWSE_ONLY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADFLOW_BROWSE_ONLY;
    else process.env.ADFLOW_BROWSE_ONLY = original;
  });

  it("자격증명이 있으면 facebook 과 guest 를 모두 등록해요", async () => {
    const ids = await providerIds();
    expect(ids).toContain("facebook");
    expect(ids).toContain("guest");
  });

  it("ADFLOW_BROWSE_ONLY 가 true 면 facebook 을 등록하지 않아요", async () => {
    process.env.ADFLOW_BROWSE_ONLY = "true";
    const ids = await providerIds();
    expect(ids).not.toContain("facebook");
    expect(ids).toContain("guest");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

단일 파일을 돌릴 때는 **`apps/web` 에서 직접 vitest 를 호출한다.** 루트의 `npm test` 는 `--workspace` 위임이라 파일 필터 인자가 그대로 전달되지 않는다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run lib/auth.test.ts
```

기대: 두 번째 테스트가 FAIL. `ADFLOW_BROWSE_ONLY` 를 아직 아무도 읽지 않으므로 `facebook` 이 여전히 등록된다. 첫 번째 테스트는 PASS.

- [ ] **Step 3: 최소 구현**

`apps/web/lib/auth.ts` 의 provider 등록 조건을 고친다. 현재:

```ts
  // Meta 자격증명이 있을 때만 Facebook provider 등록. 없으면 마법사로 강제 이동 (middleware 가드).
  if (meta) {
```

이렇게 바꾼다:

```ts
  // 둘러보기 전용 환경(백엔드 미배포)에서는 실사용 로그인을 막는다 — 로그인에 성공해도
  // 영속 레이어가 없어 빈 화면이 된다. 게스트 provider 만 남긴다.
  const browseOnly = process.env.ADFLOW_BROWSE_ONLY === "true";

  // Meta 자격증명이 있을 때만 Facebook provider 등록. 없으면 마법사로 강제 이동 (middleware 가드).
  if (meta && !browseOnly) {
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run lib/auth.test.ts
```

기대: 2 passed

- [ ] **Step 5: `vercel.json` 의 cron 제거**

폴러는 단계 6 에서 Spring 으로 간다. 그 전에도 배포 환경에는 진행할 실 토너먼트가 없어 이 cron 은 아무것도 하지 않는다.

`vercel.json` 전체를 이렇게 바꾼다:

```json
{}
```

- [ ] **Step 6: `.env.example` 에 플래그 문서화**

`apps/web/.env.example` 의 Supabase 블록 앞에 추가한다.

```
## 둘러보기 전용 모드 — 백엔드(Spring)가 없는 환경에서 실사용 로그인을 막아요.
## 배포 환경에 true 로 두면 Facebook 로그인이 사라지고 둘러보기만 남아요.
## 로컬에서는 설정하지 않아요 (실사용 경로가 필요하니까요).
# ADFLOW_BROWSE_ONLY=true
```

- [ ] **Step 7: 전체 회귀 확인**

```bash
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
```

기대: tsc 에러 0 · `Test Files 64 passed` / `Tests 676 passed` (파일 1개·테스트 2개 증가) · build 성공

- [ ] **Step 8: 커밋**

```bash
git branch --show-current
git add apps/web/lib/auth.ts apps/web/lib/auth.test.ts vercel.json apps/web/.env.example
git commit -m "feat(auth): ADFLOW_BROWSE_ONLY 로 배포 환경 둘러보기 전용 강등 · vercel cron 제거"
```

---

## 완료 조건

단계 0 이 끝난 시점에 다음이 모두 참이어야 한다.

- [ ] `apps/web` 에서 `npm run dev` 로 앱이 뜨고, Supabase 데이터 기능이 이동 전과 동일하게 동작한다
- [ ] `npm test` 가 676 tests green (기존 674 + 신규 2)
- [ ] `npm run build` 성공
- [ ] `docker compose up -d postgres` 로 Postgres 가 healthy
- [ ] `cd apps/api && ./gradlew test` 가 green
- [ ] `./gradlew bootRun` 후 `/actuator/health` 가 `{"status":"UP"}`
- [ ] `npm run contracts:generate` 가 `packages/contracts/types/api.d.ts` 를 만든다
- [ ] `ADFLOW_BROWSE_ONLY=true` 일 때 Facebook provider 가 등록되지 않는다
- [ ] git 히스토리에서 이동된 파일의 이력이 보존돼 있다 (`git log --follow apps/web/lib/auth.ts`)

## 이 단계에서 하지 않는 것

설계 문서의 단계 1 이후 항목은 손대지 않는다. 특히:

- JPA 엔티티·리포지토리 (단계 2)
- Spring Security·JWT·`/auth/exchange` (단계 1)
- 프론트의 Supabase 호출 교체 (단계 2)
- 토너먼트 정규화·엔진 포팅 (단계 5)
- Meta 클라이언트 Java 재작성 (단계 6)

`application.yml` 에 `app.poller.interval` 자리를 미리 잡는 것은 예외다 — 나중에 찾아 헤매는 비용이 지금 넣는 비용보다 크다.
