# 단계 2 — Synced Store 정규화 + Spring 영속 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tier 1 Synced Store 4개(`brand_profiles`·`library_items`·`creators`·`influencer_campaigns`)의 영속을 Supabase 에서 Spring 으로 옮긴다. DB·JPA 는 전면 정규화하되 **JSON 와이어 형태는 현재 TS 인터페이스와 1:1 로 동결**해 프론트 파급을 라우트 4개로 가둔다.

**Architecture:** Spring 이 정규화된 JPA 엔티티를 소유하고 `/stores/*` 엔드포인트를 낸다. 엔티티가 곧 와이어 타입이다 — 서버 전용 필드(`ownerKey`·`updatedAt`)만 `@JsonIgnore` 로 가린다. Next.js 의 `app/api/stores/*` 4개 라우트는 Supabase 호출을 버리고 Spring 프록시가 된다. JWT 는 여전히 Next.js 서버만 보유하므로 브라우저는 Spring 을 직접 보지 않고, `createSyncedStore` 의 계약(`GET → {items}`, `POST {item}`, `DELETE ?id=`)은 바뀌지 않는다.

**Tech Stack:** Spring Boot 4.1.0 · Spring Security 7.1.0 · Hibernate 7 / JPA · Testcontainers 2.0.5 · JDK 21 · H2(단위) / PostgreSQL 16(통합·로컬) · Next.js 16 · Vitest

## Global Constraints

- **Spring Boot 4.1.0 / Spring Security 7.1.0 / Testcontainers 2.0.5.** Boot 3 예제도, Testcontainers 1.x 예제도 통하지 않는다. 이 계획의 import 경로·아티팩트 이름은 전부 실제 컴파일·실행으로 검증한 것이다(아래 §탐침 결과).
- **와이어 형태 동결.** Spring 이 내는 JSON 의 필드명·중첩 구조·optional 여부가 현재 TS 인터페이스와 1:1 이어야 한다. 프론트의 `src/` 타입 선언은 이 단계에서 **한 줄도 바꾸지 않는다.**
- `./gradlew test` 는 **Docker 없이** green 이어야 한다(H2 인메모리). Testcontainers 는 `./gradlew integrationTest` 로만 돈다.
- `npm test` 기존 **65 files / 680 tests** 가 줄지 않는다. 신규만 늘어난다.
- `npm run build` · `npx tsc --noEmit --project apps/web/tsconfig.json` 성공 유지.
- **둘러보기는 Spring 을 호출하지 않는다.** `isRealOwner()` 게이트가 그대로 유효해야 한다 (설계 §7, 요구사항).
- 시크릿은 환경변수로만. 소스·`application.yml` 에 실값 금지.
- 커밋 메시지는 `type(scope): 한국어 설명`. **`Co-Authored-By:` 트레일러 금지** (훅이 거부).
- 커밋 전 `git branch --show-current` 확인 (현재 `dev`). **`git push` 금지.**
- 새 의존성은 이 계획에 명시된 **Gradle 3개만**: `spring-boot-testcontainers`, `org.testcontainers:testcontainers-junit-jupiter`, `org.testcontainers:testcontainers-postgresql`. npm 신규 의존성 **없음**.
- **단계 2 시작 전 롤백 태그를 찍는다**: `git tag pre-phase2`.

## 사용자가 확정한 결정 (재논의 금지)

이 4건은 계획 착수 전에 물어서 받은 답이다.

1. **refresh 토큰을 구현한다.** 단계 1 은 미구현으로 갔으나 되돌린다. 방식은 **무상태 JWT** — 서버가 토큰을 기억하지 않는다(테이블 없음). 수명 30일, `typ: refresh` 클레임.
2. **JWT 클레임·authority 는 ASCII 유지.** `LEAD`·`MEMBER_PUBLISH`·`MEMBER_REVIEW`. 화면·도메인 어휘는 한글 그대로. 매핑은 `Role.java` 한 곳. 단계 1 이 만든 상태를 그대로 둔다 — 이 단계에서 손대지 않는다.
3. **와이어 형태 동결.** 생성 타입 전면 채택은 하지 않는다. OpenAPI 생성 타입은 기존 TS 타입과의 **호환성 컴파일 검사**로만 쓴다(Task 9).
4. **Testcontainers 도입하되 태그로 분리.** `./gradlew test` 는 H2 로 Docker 없이 green 유지, `./gradlew integrationTest` 가 실제 Postgres.
5. **쓰기 실패를 상태로 노출하고 화면에 안내한다.** `createSyncedStore` 의 `.catch(() => {})` 를 제거한다.

## 설계 문서와 다르게 가는 3가지 (검토 요청)

설계 문서 `docs/superpowers/specs/2026-07-25-spring-backend-migration-design.md` 대비 세 곳이 다르다. 셋 다 근거가 있고 되돌릴 수 있다.

**1. `policy`(`SopSection[]`)는 정규화하지 않는다.** 설계 §5 는 BrandProfile 을 `brand_profiles`·`copy_references`·`goals`·`policy_sections` 로 펼친다. 그런데 실측한 `SopSection` 은 **이질적 판별 유니온**이다 — `{type, data, source?}` 에서 `data` 의 형태가 `type` 마다 다르다(`ProhibitedWordsData`·`LengthLimitsData`·`CtaRestrictionsData`·…). 이걸 관계형으로 펼치면 variant 별 테이블이거나 전 컬럼 nullable 단일 테이블이 되고, 어느 쪽이든 **와이어 형태를 복원하기 어려워진다.** 조회 조건으로 쓰이지도 않는다. 따라서 `policy` 는 JSON 텍스트 컬럼 + `AttributeConverter<JsonNode, String>` 으로 왕복시킨다(탐침으로 검증됨). `goals` 는 그대로 정규화한다 — 중첩이 있을 뿐 구조가 균질해서 관계형에 맞고, 이 단계의 유일한 `@OneToMany` 학습 재료다.

**2. `@Version` 낙관적 락을 이 단계에 넣지 않는다.** 설계 §6 이 요구하는 경합은 **폴러 vs UI** 이고 그 대상은 `tournaments` — 단계 5 다. 단계 2 의 4개 store 는 한 owner 가 한 브라우저에서 쓰는 last-write-wins 구조다. 와이어를 동결했으므로 클라이언트가 읽은 version 을 되돌려 보낼 필드가 없고, 그러면 `@Version` 은 요청 간 보호를 전혀 못 하면서 detached 엔티티 저장 시 INSERT/UPDATE 판정만 헷갈리게 만든다. **매핑 자체는 탐침으로 검증해뒀다** — 단계 5 에서 필드 하나 추가로 켜면 된다.

**3. refresh 토큰이 단계 1 이 아니라 여기서 생긴다.** 설계 §4 는 단계 1 항목으로 뒀다. 단계 1 이 미뤘고 사용자가 되돌리기로 했으므로 Task 1 이 갚는다.

## 실측으로 확인된 사실 (탐침 결과)

계획을 쓰기 전 `apps/api` 에서 실제로 컴파일하고 **Docker 컨테이너를 띄워 실행**해 확인했다. 아래는 추정이 아니다.

| 확인 항목 | 결과 |
|---|---|
| Boot 4.1.0 이 관리하는 Testcontainers | **2.0.5** (1.x 아님) |
| Testcontainers 아티팩트 이름 | `org.testcontainers:testcontainers-junit-jupiter`, `org.testcontainers:testcontainers-postgresql` — **1.x 의 `junit-jupiter`·`postgresql` 은 해석 실패** |
| `PostgreSQLContainer` 정식 패키지 | `org.testcontainers.postgresql` — `org.testcontainers.containers` 는 deprecated 별칭 |
| `PostgreSQLContainer` 제네릭 | **없음.** `new PostgreSQLContainer<>(...)` 는 컴파일 에러 (2.x 가 self-type 제거) |
| `@ServiceConnection` | `org.springframework.boot.testcontainers.service.connection.ServiceConnection` (그대로) |
| `@EntityScan` | `org.springframework.boot.persistence.autoconfigure.EntityScan` 으로 이사 |
| JvmTestSuite 에서 Boot BOM | 자동 적용 **안 됨**. `implementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))` 를 스위트 안에 명시해야 버전이 해석된다 |
| `testing { suites { } }` 와 `check` | 등록해도 `check` 가 끌고 오지 않는다 — **`./gradlew test`·`./gradlew check` 는 Docker 불필요** (`--dry-run` 으로 확인) |
| `@ElementCollection` + `@OrderColumn` | 별도 테이블로 펼쳐지고 순서 보존. 실제 Postgres 16.14 에서 확인 |
| 공유 `@Embeddable` 을 `@ElementCollection` 과 `@Embedded` 양쪽에 | **동작함.** 단 조인 컬럼과 필드 컬럼이 충돌하면 `MappingException: Column 'campaign_id' is duplicated in mapping for collection` — `@AttributeOverride` 로 해소 |
| `@OneToMany(cascade=ALL, orphanRemoval=true)` + `@JoinColumn` + `@OrderColumn` | 자식 테이블 생성·저장 확인 |
| `@Version` | 동작 확인(값 0 저장). 이 단계에서는 쓰지 않음 |
| **Boot 4 의 HTTP 컨버터는 Jackson 3(`tools.jackson`)** | 클래스패스에 Jackson 2.21 과 3.1.4 가 공존한다. `com.fasterxml.jackson.databind.JsonNode` 는 컴파일되지만 런타임에 `HttpMessageConversionException`. 애노테이션(`@JsonIgnore`·`@JsonInclude`)은 Jackson 3 도 `com.fasterxml.jackson.annotation` 을 그대로 쓴다. 구현 중 실측 |
| `value` 컬럼명 | **H2 예약어.** `create table` 이 문법 에러로 죽는데 `ddl-auto` 가 그것을 삼키고 계속 진행해, 나중에 `Table not found` 로 드러난다. `LibraryItem.primary` 와 같은 부류. 구현 중 실측 |
| springdoc 의 required 판정 | **아무 필드도 required 로 내지 않는다.** 생성 타입이 전부 optional 이 되어 도메인 타입에 대입되지 않는다. `@Schema(requiredMode = REQUIRED)` 를 필수 필드마다 붙여야 한다. 구현 중 실측 |
| `@Schema` 중복 | 반복 애노테이션이 아니다. `allowableValues` 와 `requiredMode` 는 한 애노테이션에 합쳐야 컴파일된다. 구현 중 실측 |
| **`@Schema(allowableValues=...)` 로 하이픈 enum** | **된다.** `LeadMetric.kind` 가 `enum: ['cpc-max','ctr-min']` 로 나왔다 — 계획 작성 시 미해결로 남겼던 항목이 해소됐다. 구현 중 실측 |
| 필드 수준 `@ArraySchema` 로 `$ref` 덮어쓰기 | **안 된다.** `SpringDocUtils.getConfig().replaceWithClass(JsonNode.class, Object.class)` 전역 치환이 필요하다. 구현 중 실측 |
| 파생 삭제(`deleteBy...`)를 트랜잭션 밖에서 호출 | `InvalidDataAccessApiUsageException`. 프로덕션은 `StoreController` 가 `@Transactional` 이라 무사하지만, 리포지토리를 직접 부르는 테스트는 자체 트랜잭션이 필요하다. 구현 중 실측 |
| `AttributeConverter<JsonNode, String>` + `columnDefinition = "text"` | 판별 유니온 배열이 그대로 왕복하고 **Jackson 이 문자열이 아니라 배열로 직렬화** — 와이어 동결 성립 |
| `@Testcontainers` + `@Container` static 필드 | **IT 클래스가 2개 이상이면 깨진다** — 첫 클래스 종료 시 컨테이너를 멈춰 두 번째가 `Connection refused`. 싱글턴 패턴(`static { postgres.start(); }`, 정지 안 함)으로 해소. 구현 중 실측 |
| `DelegatingOAuth2TokenValidator` | `org.springframework.security.oauth2.core` (`.jwt` 아님) |
| `NimbusJwtDecoder.setJwtValidator(...)` 로 `typ` 클레임 강제 | 동작 확인 — access 디코더가 refresh 토큰을 `JwtValidationException` 으로 거부, 그 역도 성립, 만료도 거부 |

## 단계 2 가 건드리지 않는 함정 (기록)

**Owner Key 3종 혼재(설계 §4)는 이 단계에 닿지 않는다.** 토큰 해시가 섞여 들어간 곳은 `tournaments.user_email` 이고, 단계 2 의 4개 store 는 전부 ADR-046 Owner Key(= `session.user.email`)를 쓴다. 이 함정은 단계 5·7 에서 처리한다.

**MockMvc 는 ERROR 디스패치를 재현하지 않는다.** 단계 1 에서 컨트롤러의 400 이 실제 HTTP 에서 401 로 뒤바뀌는 결함이 단위 테스트를 통과했다. 그래서 이 계획은 **Task 10 에서 신규 엔드포인트 전부를 실제 curl 로 검증**한다. 이 단계를 건너뛰지 말 것.

---

## File Structure

**apps/api — 신규**

| 경로 | 책임 |
|---|---|
| `src/main/java/ai/adflow/api/security/JwtConfig.java` (수정) | access·refresh 디코더 2개 분리, `typ` 검증기 |
| `src/main/java/ai/adflow/api/security/TokenIssuer.java` (수정) | access + refresh 동시 발급, `typ` 클레임 |
| `src/main/java/ai/adflow/api/auth/AuthRefreshController.java` | `POST /auth/refresh` |
| `src/main/java/ai/adflow/api/auth/RefreshRequest.java` | 요청 DTO |
| `src/main/java/ai/adflow/api/store/OwnerScoped.java` | `ownerKey` 를 공유하는 매핑 상위 클래스 |
| `src/main/java/ai/adflow/api/store/StoreController.java` | `/stores/*` 4개의 공통 CRUD 골격 |
| `src/main/java/ai/adflow/api/store/JsonNodeConverter.java` | JSON 텍스트 컬럼 컨버터 |
| `src/main/java/ai/adflow/api/store/library/LibraryItem.java` · `LibraryItemRepository.java` · `LibraryController.java` | Library |
| `src/main/java/ai/adflow/api/store/creator/Creator.java` · `Performance.java` · `CreatorRepository.java` · `CreatorController.java` | Creator |
| `src/main/java/ai/adflow/api/store/campaign/InfluencerCampaign.java` · `CampaignEntry.java` · `InfluencerCampaignRepository.java` · `InfluencerCampaignController.java` | InfluencerCampaign |
| `src/main/java/ai/adflow/api/store/brand/BrandProfile.java` · `CopyReference.java` · `Goal.java` · `LagTarget.java` · `LeadMetric.java` · `BrandProfileRepository.java` · `BrandProfileController.java` | BrandProfile |
| `src/integrationTest/java/...` + `src/integrationTest/resources/application-integration.yml` | Testcontainers 통합 테스트 |

**apps/web — 수정**

| 경로 | 책임 |
|---|---|
| `src/shared/lib/backend/stores.ts` (신규) | Spring `/stores/*` 프록시 단일 통로 + 401 재발급 재시도 |
| `src/shared/lib/backend/refresh.ts` (신규) | `POST /auth/refresh` 호출 |
| `app/api/stores/{brand-profiles,library,creators,influencer-campaigns}/route.ts` | Supabase → Spring 프록시 |
| `src/shared/lib/store/createSyncedStore.ts` | 쓰기 실패를 `lastError` 로 노출 |
| `src/shared/ui/Toast.tsx` | `useToastOptional()` 추가 |
| `types/next-auth.d.ts` | `backendRefreshToken` 필드 |
| `lib/auth.ts` | 교환 응답의 refresh 토큰 보관 |
| `packages/contracts/types/contract-compat.ts` (신규) | 생성 타입 ↔ 도메인 타입 호환성 컴파일 검사 |

---

## Task 1: refresh 토큰 (단계 1 편차 해소)

지금 access 토큰은 1시간이고 만료되면 재교환할 방법이 로그인밖에 없다. 무상태 refresh 토큰(30일)을 붙인다.

**핵심 함정:** 같은 키로 서명한 refresh 토큰이 **리소스 서버에서 Bearer 토큰으로 통과하면 안 된다.** 30일짜리 토큰으로 보호 API 를 다 열 수 있게 된다. `typ` 클레임과 디코더 2개로 막는다.

**Files:**
- Modify: `apps/api/src/main/java/ai/adflow/api/security/JwtConfig.java`
- Modify: `apps/api/src/main/java/ai/adflow/api/security/TokenIssuer.java`
- Modify: `apps/api/src/main/java/ai/adflow/api/security/SecurityConfig.java`
- Modify: `apps/api/src/main/java/ai/adflow/api/auth/ExchangeResponse.java`
- Modify: `apps/api/src/main/java/ai/adflow/api/auth/AuthExchangeController.java`
- Create: `apps/api/src/main/java/ai/adflow/api/auth/RefreshRequest.java`
- Create: `apps/api/src/main/java/ai/adflow/api/auth/AuthRefreshController.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Modify: `apps/api/src/test/resources/application-test.yml`
- Test: `apps/api/src/test/java/ai/adflow/api/auth/AuthRefreshControllerTest.java`
- Test: `apps/api/src/test/java/ai/adflow/api/security/TokenTypeTest.java`

**Interfaces:**
- Consumes: 단계 1 의 `Role`, `JwtConfig.ROLES_CLAIM`, `MetaConnectionRepository`
- Produces:
  - `JwtConfig.TYP_CLAIM = "typ"`, `JwtConfig.TYP_ACCESS = "access"`, `JwtConfig.TYP_REFRESH = "refresh"`
  - 빈 `JwtDecoder jwtDecoder` (**`@Primary`**, access 전용) · `JwtDecoder refreshJwtDecoder` (`@Qualifier("refreshJwtDecoder")`)
  - `TokenIssuer.issue(String ownerKey, String email, Role role)` → `TokenIssuer.Issued` (record: `String token`, `Instant expiresAt`, `String refreshToken`, `Instant refreshExpiresAt`)
  - `ExchangeResponse(String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt)`
  - `POST /auth/refresh` — 헤더 `X-Internal-Secret`, 본문 `{"refreshToken": "..."}`, 응답은 `ExchangeResponse` 와 동형

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다 — 토큰 종류 격리**

`apps/api/src/test/java/ai/adflow/api/security/TokenTypeTest.java`:

```java
package ai.adflow.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TokenTypeTest {

  @Autowired private TokenIssuer tokenIssuer;
  @Autowired private JwtDecoder jwtDecoder; // @Primary = access 전용
  @Autowired @Qualifier("refreshJwtDecoder") private JwtDecoder refreshJwtDecoder;

  private TokenIssuer.Issued issued() {
    return tokenIssuer.issue("owner@example.com", "owner@example.com", Role.LEAD);
  }

  @Test
  void access_토큰은_access_디코더를_통과한다() {
    var jwt = jwtDecoder.decode(issued().token());
    assertThat(jwt.getSubject()).isEqualTo("owner@example.com");
    assertThat(jwt.getClaimAsStringList("roles")).containsExactly("LEAD");
    assertThat(jwt.getClaimAsString("typ")).isEqualTo("access");
  }

  @Test
  void refresh_토큰은_리소스서버_디코더에서_거부된다() {
    String refresh = issued().refreshToken();
    // 이게 이 Task 의 요지다 — 30일짜리 refresh 로 보호 API 를 열 수 없어야 한다.
    assertThatThrownBy(() -> jwtDecoder.decode(refresh))
        .isInstanceOf(JwtValidationException.class);
  }

  @Test
  void access_토큰은_refresh_디코더에서_거부된다() {
    String access = issued().token();
    assertThatThrownBy(() -> refreshJwtDecoder.decode(access))
        .isInstanceOf(JwtValidationException.class);
  }

  @Test
  void refresh_토큰이_access_보다_오래_산다() {
    var i = issued();
    assertThat(i.refreshExpiresAt()).isAfter(i.expiresAt());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `refreshJwtDecoder` 빈이 없고 `Issued` 에 `refreshToken()` 이 없어 컴파일 에러.

- [ ] **Step 3: JwtConfig 에 디코더 2개와 typ 검증기를 넣는다**

`apps/api/src/main/java/ai/adflow/api/security/JwtConfig.java` 를 아래로 **교체**한다.

```java
package ai.adflow.api.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** HS256 대칭키 서명. 발급자와 검증자가 모두 이 서비스라 비대칭키가 필요 없다. */
@Configuration
public class JwtConfig {

  public static final String ROLES_CLAIM = "roles";
  public static final String TYP_CLAIM = "typ";
  public static final String TYP_ACCESS = "access";
  public static final String TYP_REFRESH = "refresh";

  private final SecretKeySpec key;

  public JwtConfig(@Value("${app.jwt.secret}") String secret) {
    byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
    if (raw.length < 32) {
      throw new IllegalStateException("app.jwt.secret 은 32바이트 이상이어야 해요 (HS256 요구사항). 현재 " + raw.length + "바이트.");
    }
    this.key = new SecretKeySpec(raw, "HmacSHA256");
  }

  @Bean
  JwtEncoder jwtEncoder() {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  /**
   * 리소스 서버용 — access 토큰만 받는다.
   *
   * 같은 키로 서명한 refresh 토큰이 Bearer 로 통과하면 30일짜리 토큰으로 보호 API 가 전부 열린다.
   * typ 검증기가 그것을 막는 유일한 장치다.
   */
  @Bean
  @Primary
  JwtDecoder jwtDecoder() {
    return decoderRequiring(TYP_ACCESS);
  }

  /** /auth/refresh 전용 — refresh 토큰만 받는다. access 토큰으로는 갱신할 수 없다. */
  @Bean
  JwtDecoder refreshJwtDecoder() {
    return decoderRequiring(TYP_REFRESH);
  }

  private JwtDecoder decoderRequiring(String expectedTyp) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).build();
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), requireTyp(expectedTyp)));
    return decoder;
  }

  private static OAuth2TokenValidator<Jwt> requireTyp(String expected) {
    return jwt ->
        expected.equals(jwt.getClaimAsString(TYP_CLAIM))
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "이 토큰은 " + expected + " 용이 아니에요.", null));
  }

  /** roles 클레임(["LEAD"])을 ROLE_LEAD authority 로 바꾼다 — hasRole("LEAD") 가 동작하게. */
  @Bean
  JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
    authorities.setAuthorityPrefix("ROLE_");
    authorities.setAuthoritiesClaimName(ROLES_CLAIM);

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return converter;
  }
}
```

- [ ] **Step 4: TokenIssuer 가 두 토큰을 함께 발급한다**

`apps/api/src/main/java/ai/adflow/api/security/TokenIssuer.java` 를 아래로 **교체**한다.

```java
package ai.adflow.api.security;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

@Component
public class TokenIssuer {

  private final JwtEncoder encoder;
  private final Duration ttl;
  private final Duration refreshTtl;

  public TokenIssuer(
      JwtEncoder encoder,
      @Value("${app.jwt.ttl}") Duration ttl,
      @Value("${app.jwt.refresh-ttl}") Duration refreshTtl) {
    this.encoder = encoder;
    this.ttl = ttl;
    this.refreshTtl = refreshTtl;
  }

  public Issued issue(String ownerKey, String email, Role role) {
    Instant now = Instant.now();
    Instant accessExp = now.plus(ttl);
    Instant refreshExp = now.plus(refreshTtl);

    String access = sign(JwtConfig.TYP_ACCESS, ownerKey, email, role, now, accessExp);
    // refresh 에도 역할을 담는다 — 갱신 시 DB 를 다시 읽지 않고 그대로 넘긴다.
    String refresh = sign(JwtConfig.TYP_REFRESH, ownerKey, email, role, now, refreshExp);

    return new Issued(access, accessExp, refresh, refreshExp);
  }

  private String sign(
      String typ, String ownerKey, String email, Role role, Instant now, Instant expiresAt) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("adflow-api")
            .subject(ownerKey)
            .issuedAt(now)
            .expiresAt(expiresAt)
            .claim("email", email)
            .claim(JwtConfig.TYP_CLAIM, typ)
            .claim(JwtConfig.ROLES_CLAIM, List.of(role.authority()))
            .build();

    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
        .getTokenValue();
  }

  public record Issued(
      String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt) {}
}
```

- [ ] **Step 5: 응답 DTO 와 교환 컨트롤러를 맞춘다**

`apps/api/src/main/java/ai/adflow/api/auth/ExchangeResponse.java` 를 교체한다.

```java
package ai.adflow.api.auth;

import java.time.Instant;

public record ExchangeResponse(
    String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt) {}
```

`apps/api/src/main/java/ai/adflow/api/auth/AuthExchangeController.java` 의 마지막 두 줄을 바꾼다.

```java
    TokenIssuer.Issued issued = tokenIssuer.issue(request.ownerKey(), request.email(), role);
    return ResponseEntity.ok(
        new ExchangeResponse(
            issued.token(), issued.expiresAt(), issued.refreshToken(), issued.refreshExpiresAt()));
```

- [ ] **Step 6: 갱신 엔드포인트를 만든다**

`apps/api/src/main/java/ai/adflow/api/auth/RefreshRequest.java`:

```java
package ai.adflow.api.auth;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(@NotBlank String refreshToken) {}
```

`apps/api/src/main/java/ai/adflow/api/auth/AuthRefreshController.java`:

```java
package ai.adflow.api.auth;

import ai.adflow.api.security.JwtConfig;
import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 무상태 갱신 — 서버는 발급한 refresh 토큰을 기억하지 않는다(테이블 없음).
 *
 * 개별 토큰 회수가 필요해지면 서명키를 바꾸는 것이 유일한 무효화 수단이다. 보유 주체가
 * 브라우저가 아니라 Next.js 서버라 탈취 면이 좁아 이 절충을 택했다.
 */
@RestController
@RequestMapping("/auth")
public class AuthRefreshController {

  private final JwtDecoder refreshJwtDecoder;
  private final TokenIssuer tokenIssuer;
  private final byte[] internalSecret;

  public AuthRefreshController(
      @Qualifier("refreshJwtDecoder") JwtDecoder refreshJwtDecoder,
      TokenIssuer tokenIssuer,
      @Value("${app.internal-secret}") String internalSecret) {
    this.refreshJwtDecoder = refreshJwtDecoder;
    this.tokenIssuer = tokenIssuer;
    this.internalSecret = internalSecret.getBytes(StandardCharsets.UTF_8);
  }

  @PostMapping("/refresh")
  public ResponseEntity<ExchangeResponse> refresh(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @Valid @RequestBody RefreshRequest request) {

    requireInternalSecret(presented);

    Jwt jwt;
    try {
      jwt = refreshJwtDecoder.decode(request.refreshToken());
    } catch (JwtException e) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "갱신 토큰이 유효하지 않아요. 다시 로그인해 주세요.");
    }

    List<String> roles = jwt.getClaimAsStringList(JwtConfig.ROLES_CLAIM);
    Role role = roles == null || roles.isEmpty() ? Role.LEAD : Role.fromAuthority(roles.get(0));
    String email = jwt.getClaimAsString("email");

    TokenIssuer.Issued issued = tokenIssuer.issue(jwt.getSubject(), email, role);
    return ResponseEntity.ok(
        new ExchangeResponse(
            issued.token(), issued.expiresAt(), issued.refreshToken(), issued.refreshExpiresAt()));
  }

  /** 타이밍 공격을 피하려고 상수시간 비교를 쓴다. */
  private void requireInternalSecret(String presented) {
    if (presented == null
        || !MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), internalSecret)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "내부 호출 자격이 없어요.");
    }
  }
}
```

- [ ] **Step 7: `/auth/refresh` 를 공개 경로에 넣는다**

`apps/api/src/main/java/ai/adflow/api/security/SecurityConfig.java` 의 `requestMatchers("/auth/exchange")` 줄을 바꾼다.

```java
                    // 교환·갱신은 JWT 를 받기 전/재발급 단계다. 내부 시크릿으로 따로 지킨다.
                    .requestMatchers("/auth/exchange", "/auth/refresh")
                    .permitAll()
```

- [ ] **Step 8: refresh 수명을 설정에 추가한다**

`apps/api/src/main/resources/application.yml` 의 `app.jwt` 블록을 바꾼다.

```yaml
  jwt:
    # HS256 서명키. 32바이트 이상. 실값은 환경변수 ADFLOW_JWT_SECRET 로만 준다.
    secret: ${ADFLOW_JWT_SECRET:}
    ttl: PT1H
    # 무상태 갱신 토큰 수명. 서버가 기억하지 않으므로 개별 회수 수단은 서명키 교체뿐이다.
    refresh-ttl: P30D
```

`apps/api/src/test/resources/application-test.yml` 의 `app.jwt` 블록에도 같은 줄을 더한다.

```yaml
  jwt:
    secret: test-secret-key-for-hs256-at-least-32-bytes
    ttl: PT1H
    refresh-ttl: P30D
```

- [ ] **Step 9: 갱신 엔드포인트 테스트를 쓴다**

`apps/api/src/test/java/ai/adflow/api/auth/AuthRefreshControllerTest.java`:

```java
package ai.adflow.api.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthRefreshControllerTest {

  private static final String SECRET_HEADER = "X-Internal-Secret";
  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;
  @Autowired private TokenIssuer tokenIssuer;

  private String body(String refreshToken) {
    return "{\"refreshToken\":\"" + refreshToken + "\"}";
  }

  private TokenIssuer.Issued issued() {
    return tokenIssuer.issue("owner@example.com", "owner@example.com", Role.MEMBER_REVIEW);
  }

  @Test
  void 내부_시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().refreshToken())))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 정상_갱신이면_새_토큰쌍을_준다() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().refreshToken())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andExpect(jsonPath("$.refreshToken").isNotEmpty())
        .andExpect(jsonPath("$.expiresAt").isNotEmpty())
        .andExpect(jsonPath("$.refreshExpiresAt").isNotEmpty());
  }

  @Test
  void access_토큰으로는_갱신할_수_없다() throws Exception {
    // 이게 typ 분리의 요지다.
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(issued().token())))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 쓰레기_토큰은_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/refresh")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("not-a-jwt")))
        .andExpect(status().isUnauthorized());
  }
}
```

- [ ] **Step 10: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 16건 + `TokenTypeTest` 4건 + `AuthRefreshControllerTest` 4건 = **24건**.

`AuthExchangeControllerTest.정상_교환이면_JWT와_역할클레임을_준다` 가 깨지면 `@Primary` 가 빠진 것이다 — 그 테스트는 `JwtDecoder` 를 이름 없이 주입받으므로 후보가 둘이면 주입 자체가 실패한다.

- [ ] **Step 11: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git branch --show-current   # dev 확인
git add apps/api
git commit -m "feat(api): 무상태 refresh 토큰 · POST /auth/refresh — typ 클레임으로 access 와 격리"
```

---

## Task 2: Testcontainers 통합 테스트 하네스

`ddl-auto: update` 를 쓰는 동안 엔티티 매핑 오류를 잡아줄 것이 없다. H2 는 PostgreSQL 모드여도 예약어·타입·컬렉션 테이블 생성에서 실제 Postgres 와 다르게 군다. Task 3 부터 들어올 정규화 스키마를 **진짜 Postgres 16 에 올려서** 검증할 하네스를 먼저 만든다.

`./gradlew test` 가 Docker 없이 도는 성질은 유지한다 — 별도 소스셋·별도 태스크로 분리하고 `check` 에 걸지 않는다.

**Files:**
- Modify: `apps/api/build.gradle.kts`
- Create: `apps/api/src/integrationTest/resources/application-integration.yml`
- Create: `apps/api/src/integrationTest/java/ai/adflow/api/IntegrationTestBase.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/connection/MetaConnectionPostgresIT.java`

**Interfaces:**
- Consumes: 단계 1 의 `MetaConnection`·`MetaConnectionRepository`
- Produces:
  - Gradle 태스크 `integrationTest` (`src/integrationTest/java`, `src/integrationTest/resources`)
  - `IntegrationTestBase` — `@SpringBootTest` + `@Testcontainers` + `@ServiceConnection` 컨테이너를 물려주는 상위 클래스. 하위 IT 는 `extends IntegrationTestBase` 만 하면 된다.
  - 프로필 `integration`

- [ ] **Step 1: Gradle 소스셋과 태스크를 만든다**

`apps/api/build.gradle.kts` 의 `dependencies { ... }` 블록 **다음**, `tasks.withType<Test>` **앞**에 넣는다.

```kotlin
testing {
	suites {
		// Testcontainers 통합 테스트. 기본 `test` 와 분리해 ./gradlew test 가 Docker 없이 돌게 둔다.
		// check 에 걸지 않는다 — 걸면 Docker 없는 환경에서 check 가 깨진다.
		val integrationTest by registering(JvmTestSuite::class) {
			useJUnitJupiter()
			dependencies {
				// io.spring.dependency-management 는 표준 configuration 에만 붙는다.
				// 새 스위트에는 BOM 을 직접 얹어야 testcontainers 버전이 해석된다.
				implementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))
				implementation(project())
				implementation("org.springframework.boot:spring-boot-starter-webmvc")
				implementation("org.springframework.boot:spring-boot-starter-data-jpa")
				implementation("org.springframework.boot:spring-boot-starter-webmvc-test")
				implementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
				implementation("org.springframework.security:spring-security-test")
				implementation("org.springframework.boot:spring-boot-testcontainers")
				// Testcontainers 2.x 아티팩트 이름. 1.x 의 junit-jupiter·postgresql 은 해석 실패한다.
				implementation("org.testcontainers:testcontainers-junit-jupiter")
				implementation("org.testcontainers:testcontainers-postgresql")
				runtimeOnly("org.postgresql:postgresql")
			}
		}
	}
}
```

- [ ] **Step 2: 통합 프로필 설정을 만든다**

`apps/api/src/integrationTest/resources/application-integration.yml`:

```yaml
spring:
  jpa:
    hibernate:
      # 컨테이너가 매번 새로 뜨므로 create 로 충분하다. create-drop 은 컨테이너가 먼저 내려간 뒤
      # drop 을 시도해 종료 로그에 무의미한 에러를 쏟는다.
      ddl-auto: create

app:
  internal-secret: it-internal-secret
  jwt:
    secret: it-secret-key-for-hs256-at-least-32-bytes
    ttl: PT1H
    refresh-ttl: P30D
  encryption:
    key: it-encryption-key-32-bytes-okay!
```

`it-encryption-key-32-bytes-okay!` 는 정확히 32바이트다. 길이를 바꾸면 컨텍스트 로딩이 실패한다.

- [ ] **Step 3: 공통 상위 클래스를 만든다**

`apps/api/src/integrationTest/java/ai/adflow/api/IntegrationTestBase.java`:

```java
package ai.adflow.api;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 실제 Postgres 16 위에서 도는 통합 테스트의 공통 바탕.
 *
 * 싱글턴 컨테이너 패턴이다 — @Testcontainers/@Container 를 쓰지 않고 static 초기화로 직접 띄운다.
 * JUnit 의 @Container 생명주기는 테스트 클래스가 끝날 때 컨테이너를 멈추는데 static 필드는 JVM
 * 전체에서 공유되므로, 두 번째 IT 클래스가 이미 멈춘 컨테이너의 포트에 붙어 Connection refused 로
 * 죽는다. 여기서는 멈추지 않고 JVM 종료 시 Ryuk 이 정리하게 둔다.
 *
 * Testcontainers 2.x 주의 — PostgreSQLContainer 는 org.testcontainers.postgresql 에 있고
 * 더 이상 제네릭이 아니다. `new PostgreSQLContainer<>(...)` 는 컴파일되지 않는다.
 */
@SpringBootTest
@ActiveProfiles("integration")
public abstract class IntegrationTestBase {

  @ServiceConnection
  static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

  static {
    postgres.start();
  }
}
```

- [ ] **Step 4: 하네스를 증명하는 첫 IT 를 쓴다**

새 엔티티를 만들기 전에 **하네스 자체가 도는지** 기존 `meta_connections` 로 확인한다. 실패하면 원인이 하네스지 새 매핑이 아니다.

`apps/api/src/integrationTest/java/ai/adflow/api/connection/MetaConnectionPostgresIT.java`:

```java
package ai.adflow.api.connection;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.security.Role;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class MetaConnectionPostgresIT extends IntegrationTestBase {

  private static final String PLAIN_TOKEN = "EAAG-super-secret-meta-token";

  @Autowired private MetaConnectionRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;

  @Test
  void 진짜_Postgres16_위에서_돈다() {
    String version = jdbcTemplate.queryForObject("select version()", String.class);
    assertThat(version).contains("PostgreSQL 16");
  }

  @Test
  void 암호화_컬럼이_실제_Postgres_에서도_왕복한다() {
    MetaConnection c = new MetaConnection();
    c.setOwnerKey("pg@example.com");
    c.setEmail("pg@example.com");
    c.setRole(Role.LEAD);
    c.setAccessToken(PLAIN_TOKEN);
    c.setUpdatedAt(Instant.now());
    repository.saveAndFlush(c);

    assertThat(repository.findById("pg@example.com").orElseThrow().getAccessToken())
        .isEqualTo(PLAIN_TOKEN);

    String stored =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "pg@example.com");
    assertThat(stored).isNotEqualTo(PLAIN_TOKEN);
    assertThat(stored).doesNotContain("EAAG");
  }
}
```

- [ ] **Step 5: 통합 테스트가 통과하는 것을 확인**

Docker 가 떠 있어야 한다.

```bash
docker info > /dev/null && echo "docker OK"
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 2건. 첫 실행은 이미지 pull 로 1~2분 걸린다.

- [ ] **Step 6: 기본 테스트가 Docker 없이도 도는지 확인한다**

이게 이 Task 의 제약이다. 분리가 실제로 됐는지 본다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api
./gradlew test --no-daemon
./gradlew check --dry-run --no-daemon | grep -i integrationTest || echo "check 는 integrationTest 를 끌고 오지 않아요 — 정상"
```

기대: `test` 24건 green. 두 번째 명령의 grep 이 아무것도 못 찾아 `정상` 문구가 출력된다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "test(api): Testcontainers 통합 테스트 하네스 — 기본 test 는 Docker 없이 유지"
```

---

## Task 3: LibraryItem — 첫 정규화 엔티티 + `/stores/*` 공통 골격

가장 단순한 엔티티(플랫 13필드, 중첩 없음)로 **저장소 엔드포인트의 패턴을 확립한다.** Task 4~6 은 이 골격 위에 중첩 구조만 얹는다.

**Files:**
- Modify: `apps/api/src/main/resources/application.yml`
- Create: `apps/api/src/main/java/ai/adflow/api/store/OwnerScoped.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/OwnerScopedRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/StoreController.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/ItemsResponse.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/ItemRequest.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/library/LibraryItem.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/library/LibraryItemRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/library/LibraryController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/library/LibraryControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/library/LibraryPostgresIT.java`

**Interfaces:**
- Consumes: Task 1 의 `JwtConfig`(access 디코더), Task 2 의 `IntegrationTestBase`
- Produces:
  - `@MappedSuperclass OwnerScoped` — 필드 `String id`(`@Id`), `String ownerKey`(`@JsonIgnore`), `Instant updatedAt`(`@JsonIgnore`). 접근자 `getId/setId`, `getOwnerKey/setOwnerKey`, `getUpdatedAt/setUpdatedAt`.
  - `OwnerScopedRepository<T extends OwnerScoped> extends JpaRepository<T, String>` — `List<T> findByOwnerKeyOrderByUpdatedAtDesc(String ownerKey)`, `void deleteByIdAndOwnerKey(String id, String ownerKey)`
  - `abstract StoreController<T extends OwnerScoped>` — `GET`/`POST`/`DELETE` 구현. 하위는 생성자로 리포지토리만 넘긴다.
  - `record ItemsResponse<T>(List<T> items)` · `record ItemRequest<T>(T item)`
  - `GET /stores/library` → `{"items":[LibraryItem]}` · `POST /stores/library` 본문 `{"item":{...}}` → `{"ok":true}` · `DELETE /stores/library?id=<id>` → `{"ok":true}`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

와이어 형태 동결이 이 Task 의 계약이다. 응답 JSON 의 필드명이 TS `LibraryItem` 과 정확히 같은지, 서버 전용 필드가 새지 않는지를 본다.

`apps/api/src/test/java/ai/adflow/api/store/library/LibraryControllerTest.java`:

```java
package ai.adflow.api.store.library;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LibraryControllerTest {

  // TS LibraryItem 과 필드가 1:1 이다. image 는 optional 이라 뺀다.
  private static final String ITEM =
      """
      {
        "id": "cre_1",
        "savedAt": 1753500000000,
        "brand": "그린루틴",
        "headline": "아침을 바꾸는 한 잔",
        "primary": "매일 마시는 루틴",
        "tone": "warm",
        "toneLabel": "따뜻하게",
        "ctaId": "SHOP_NOW",
        "ctaLabel": "지금 구매",
        "goal": "conversions",
        "target": "30대 여성",
        "gradient": "sunrise",
        "tag": "신규"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/library")).andExpect(status().isUnauthorized());
  }

  @Test
  void 저장하고_읽으면_와이어_형태가_그대로다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM + "}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ok").value(true));

    mockMvc
        .perform(get("/stores/library").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("cre_1"))
        .andExpect(jsonPath("$.items[0].savedAt").value(1753500000000L))
        .andExpect(jsonPath("$.items[0].primary").value("매일 마시는 루틴"))
        .andExpect(jsonPath("$.items[0].ctaLabel").value("지금 구매"))
        // 서버 전용 필드가 와이어로 새면 안 된다.
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist())
        .andExpect(jsonPath("$.items[0].updatedAt").doesNotExist())
        // optional 미설정 필드는 키 자체가 없어야 한다 — TS 의 image?: string 과 맞추려면 null 이 아니라 부재다.
        .andExpect(jsonPath("$.items[0].image").doesNotExist());
  }

  @Test
  void 남의_항목은_보이지_않는다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("b@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM.replace("cre_1", "cre_b") + "}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/library").with(owner("c@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 남의_항목은_삭제되지_않는다() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("d@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + ITEM.replace("cre_1", "cre_d") + "}"))
        .andExpect(status().isOk());

    // 다른 사람이 같은 id 로 삭제를 시도해도 지워지면 안 된다.
    mockMvc
        .perform(delete("/stores/library").param("id", "cre_d").with(owner("e@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/library").with(owner("d@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("cre_d"));
  }

  @Test
  void id_없는_항목은_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/library")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"brand\":\"이름만\"}}"))
        .andExpect(status().isBadRequest());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/library` 가 없어 401(리소스 서버가 인증을 먼저 본다) 또는 404.

- [ ] **Step 3: Jackson 이 null 필드를 빼도록 설정한다**

TS 의 `image?: string` 에 `null` 은 대입되지 않는다. **키가 아예 없어야** 와이어가 맞는다.

`apps/api/src/main/resources/application.yml` 의 `spring:` 블록 안, `jpa:` 다음에 넣는다.

```yaml
  jackson:
    # TS 의 optional(`field?: T`)과 맞추려면 null 필드는 키 자체가 없어야 한다.
    # 명시적으로 null 을 실어야 하는 필드는 @JsonInclude(ALWAYS) 로 개별 예외 처리한다.
    default-property-inclusion: non_null
```

- [ ] **Step 4: 공통 상위 타입을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/OwnerScoped.java`:

```java
package ai.adflow.api.store;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Synced Store 엔티티의 공통 바탕.
 *
 * 엔티티가 곧 와이어 타입이다(와이어 형태 동결). 서버 전용 필드는 @JsonIgnore 로 가린다 —
 * ownerKey 를 노출하면 TS 타입에 없는 필드가 응답에 섞이고, updatedAt 은 정렬용 내부 값이다.
 *
 * id 는 클라이언트가 만든 문자열이다(cre_·bp_ 접두). 서버가 생성하지 않는다.
 */
@MappedSuperclass
public abstract class OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Id
  private String id;

  @JsonIgnore
  @Column(name = "owner_key", nullable = false)
  private String ownerKey;

  /** 목록 정렬 기준. Supabase 의 synced_at desc 순서를 그대로 승계한다. */
  @JsonIgnore
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getOwnerKey() { return ownerKey; }
  public void setOwnerKey(String v) { this.ownerKey = v; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
```

`apps/api/src/main/java/ai/adflow/api/store/OwnerScopedRepository.java`:

```java
package ai.adflow.api.store;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface OwnerScopedRepository<T extends OwnerScoped> extends JpaRepository<T, String> {

  List<T> findByOwnerKeyOrderByUpdatedAtDesc(String ownerKey);

  /** id 만으로 지우지 않는다 — 남의 행을 지울 수 있게 된다. */
  void deleteByIdAndOwnerKey(String id, String ownerKey);
}
```

- [ ] **Step 5: 요청·응답 봉투를 만든다**

`createSyncedStore` 의 기존 계약을 그대로 쓴다 — 프론트를 고치지 않기 위해서다.

`apps/api/src/main/java/ai/adflow/api/store/ItemsResponse.java`:

```java
package ai.adflow.api.store;

import java.util.List;

public record ItemsResponse<T>(List<T> items) {}
```

`apps/api/src/main/java/ai/adflow/api/store/ItemRequest.java`:

```java
package ai.adflow.api.store;

public record ItemRequest<T>(T item) {}
```

- [ ] **Step 6: 공통 컨트롤러 골격을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/StoreController.java`:

```java
package ai.adflow.api.store;

import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

/**
 * Synced Store 엔드포인트 4개의 공통 CRUD.
 *
 * 계약은 프론트의 createSyncedStore 가 이미 쓰던 것 그대로다 —
 * GET → {items}, POST {item}, DELETE ?id=. 프론트를 고치지 않으려고 봉투를 승계했다.
 *
 * owner 는 항상 JWT subject 에서 온다. 요청 본문의 값은 신뢰하지 않는다.
 */
public abstract class StoreController<T extends OwnerScoped> {

  private final OwnerScopedRepository<T> repository;

  protected StoreController(OwnerScopedRepository<T> repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<T> list(@AuthenticationPrincipal Jwt jwt) {
    List<T> items = repository.findByOwnerKeyOrderByUpdatedAtDesc(jwt.getSubject());
    return new ItemsResponse<>(items);
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<T> body) {

    T item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());

    // 지우고 새로 넣는다. 클라이언트가 항상 전체 문서를 보내므로(createSyncedStore 의 postItem)
    // 병합이 필요 없고, 자식 컬렉션의 고아 처리·detached 병합 함정을 통째로 피한다.
    // ponytail: 애그리거트가 수십 행 규모라 이 방식으로 충분하다. 커지면 병합으로 바꾼다.
    repository.deleteByIdAndOwnerKey(item.getId(), jwt.getSubject());
    repository.flush();
    repository.save(item);

    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public ResponseEntity<Map<String, Boolean>> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("id") String id) {
    repository.deleteByIdAndOwnerKey(id, jwt.getSubject());
    return ResponseEntity.ok(Map.of("ok", true));
  }
}
```

- [ ] **Step 7: LibraryItem 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/library/LibraryItem.java`:

```java
package ai.adflow.api.store.library;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/shared/lib/library.ts 의 LibraryItem 과 필드 1:1. */
@Entity
@Table(name = "library_items")
public class LibraryItem extends OwnerScoped {

  @Column(name = "saved_at", nullable = false)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Long savedAt;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String brand;

  @Column(length = 1000)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String headline;

  // TS 필드명은 primary 지만 PRIMARY 는 SQL 예약어라 컬럼만 바꾼다.
  // Jackson 은 자바 프로퍼티명을 쓰므로 와이어는 그대로 "primary" 다.
  @Column(name = "primary_text", length = 4000)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String primary;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String tone;

  @Column(name = "tone_label")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String toneLabel;

  @Column(name = "cta_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String ctaId;

  @Column(name = "cta_label")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String ctaLabel;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String goal;
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String target;
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String gradient;

  @Column(length = 2000)
  private String image;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String tag;

  public Long getSavedAt() { return savedAt; }
  public void setSavedAt(Long v) { this.savedAt = v; }
  public String getBrand() { return brand; }
  public void setBrand(String v) { this.brand = v; }
  public String getHeadline() { return headline; }
  public void setHeadline(String v) { this.headline = v; }
  public String getPrimary() { return primary; }
  public void setPrimary(String v) { this.primary = v; }
  public String getTone() { return tone; }
  public void setTone(String v) { this.tone = v; }
  public String getToneLabel() { return toneLabel; }
  public void setToneLabel(String v) { this.toneLabel = v; }
  public String getCtaId() { return ctaId; }
  public void setCtaId(String v) { this.ctaId = v; }
  public String getCtaLabel() { return ctaLabel; }
  public void setCtaLabel(String v) { this.ctaLabel = v; }
  public String getGoal() { return goal; }
  public void setGoal(String v) { this.goal = v; }
  public String getTarget() { return target; }
  public void setTarget(String v) { this.target = v; }
  public String getGradient() { return gradient; }
  public void setGradient(String v) { this.gradient = v; }
  public String getImage() { return image; }
  public void setImage(String v) { this.image = v; }
  public String getTag() { return tag; }
  public void setTag(String v) { this.tag = v; }
}
```

- [ ] **Step 8: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/library/LibraryItemRepository.java`:

```java
package ai.adflow.api.store.library;

import ai.adflow.api.store.OwnerScopedRepository;

public interface LibraryItemRepository extends OwnerScopedRepository<LibraryItem> {}
```

`apps/api/src/main/java/ai/adflow/api/store/library/LibraryController.java`:

```java
package ai.adflow.api.store.library;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 경로는 프론트의 /api/stores/library 와 맞춘다 — 라우트가 얇은 프록시가 되도록. */
@RestController
@RequestMapping("/stores/library")
public class LibraryController extends StoreController<LibraryItem> {

  public LibraryController(LibraryItemRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 9: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 24건 + `LibraryControllerTest` 5건 = **29건**.

`items[0].ownerKey` 가 존재해서 실패하면 `@JsonIgnore` 가 빠진 것이다. `image` 키가 존재해서 실패하면 Step 3 의 `default-property-inclusion` 이 안 먹은 것이다.

- [ ] **Step 10: 실제 Postgres 에서 스키마를 확인한다**

`primary_text` 로 바꾼 컬럼이 실제로 만들어지는지가 요점이다. H2 는 `PRIMARY` 를 통과시킬 수도 있어 여기서만 드러난다.

`apps/api/src/integrationTest/java/ai/adflow/api/store/library/LibraryPostgresIT.java`:

```java
package ai.adflow.api.store.library;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class LibraryPostgresIT extends IntegrationTestBase {

  @Autowired private LibraryItemRepository repository;
  @Autowired private JdbcTemplate jdbc;

  private LibraryItem sample(String id, String owner) {
    LibraryItem i = new LibraryItem();
    i.setId(id);
    i.setOwnerKey(owner);
    i.setUpdatedAt(Instant.now());
    i.setSavedAt(1753500000000L);
    i.setBrand("그린루틴");
    i.setPrimary("매일 마시는 루틴");
    return i;
  }

  @Test
  void 예약어_컬럼이_실제_Postgres_에서_생성된다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'library_items' order by 1",
            String.class);
    assertThat(columns).contains("primary_text", "owner_key", "updated_at", "saved_at", "cta_label");
    assertThat(columns).doesNotContain("primary");
  }

  @Test
  void owner_스코프_정렬이_최신순이다() {
    LibraryItem older = sample("cre_old", "sort@example.com");
    older.setUpdatedAt(Instant.parse("2026-01-01T00:00:00Z"));
    LibraryItem newer = sample("cre_new", "sort@example.com");
    newer.setUpdatedAt(Instant.parse("2026-06-01T00:00:00Z"));
    repository.saveAllAndFlush(List.of(older, newer));

    assertThat(repository.findByOwnerKeyOrderByUpdatedAtDesc("sort@example.com"))
        .extracting(LibraryItem::getId)
        .containsExactly("cre_new", "cre_old");
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 4건 (기존 2 + 신규 2).

- [ ] **Step 11: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/library 엔드포인트 · Synced Store 공통 골격 — 와이어 형태 동결"
```

---

## Task 4: Creator — 컬렉션 정규화와 공유 Embeddable

`Creator` 는 `category: string[]` 과 `performanceHistory: CreatorPerformance[]` 를 가진다. 둘 다 별도 테이블로 펼친다.

**`CreatorPerformance` 는 Task 5 의 `CampaignEntry` 안에서도 쓰인다.** 그래서 `@Entity` 가 아니라 `@Embeddable` 로 만든다 — 한 타입이 엔티티이면서 임베더블일 수는 없다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/creator/Performance.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/creator/CreatorPlatform.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/creator/Creator.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/creator/CreatorRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/creator/CreatorController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/creator/CreatorControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/creator/CreatorPostgresIT.java`

**Interfaces:**
- Consumes: Task 3 의 `OwnerScoped`·`OwnerScopedRepository`·`StoreController`
- Produces:
  - `@Embeddable Performance` — 필드 `String campaignId`, `Integer reach`, `Integer clicks`, `Integer conversions`, `Double revenue`, `Double cost`, `String recordedAt`. **Task 5 가 이 타입을 재사용한다.**
  - `enum CreatorPlatform { instagram, youtube, tiktok, other }` — 상수명이 곧 와이어 값이다.
  - `@Entity Creator extends OwnerScoped`
  - `GET/POST/DELETE /stores/creators`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/creator/CreatorControllerTest.java`:

```java
package ai.adflow.api.store.creator;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CreatorControllerTest {

  // TS Creator 와 1:1. 순서가 있는 배열 두 개가 이 Task 의 요점이다.
  private static final String ITEM =
      """
      {
        "id": "cr_1",
        "handle": "@greenroutine",
        "platform": "instagram",
        "displayName": "그린루틴",
        "category": ["뷰티", "푸드", "라이프"],
        "followerCount": 12000,
        "performanceHistory": [
          {"campaignId": "camp_1", "reach": 1000, "clicks": 80, "recordedAt": "2026-05-01T00:00:00Z"},
          {"campaignId": "camp_2", "reach": 2000, "conversions": 12, "recordedAt": "2026-06-01T00:00:00Z"}
        ],
        "createdAt": "2026-04-01T00:00:00Z"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/creators")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 중첩_배열이_순서까지_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/creators").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].category[0]").value("뷰티"))
        .andExpect(jsonPath("$.items[0].category[2]").value("라이프"))
        .andExpect(jsonPath("$.items[0].performanceHistory[0].campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].performanceHistory[1].conversions").value(12))
        .andExpect(jsonPath("$.items[0].platform").value("instagram"))
        // optional 미설정은 키 부재.
        .andExpect(jsonPath("$.items[0].note").doesNotExist())
        .andExpect(jsonPath("$.items[0].performanceHistory[0].conversions").doesNotExist());
  }

  @Test
  void 재저장하면_이전_컬렉션이_남지_않는다() throws Exception {
    save("b@example.com", ITEM);
    // 같은 id 로 카테고리 1개짜리를 다시 저장한다. 고아가 남으면 3개가 그대로 보인다.
    save("b@example.com", ITEM.replace("[\"뷰티\", \"푸드\", \"라이프\"]", "[\"뷰티\"]"));

    mockMvc
        .perform(get("/stores/creators").with(owner("b@example.com")))
        .andExpect(jsonPath("$.items[0].category.length()").value(1))
        .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void 빈_배열은_null_이_아니라_빈_배열로_나온다() throws Exception {
    save(
        "c@example.com",
        ITEM.replace("cr_1", "cr_empty")
            .replace("[\"뷰티\", \"푸드\", \"라이프\"]", "[]")
            .replaceAll("(?s)\"performanceHistory\": \\[.*?\\]", "\"performanceHistory\": []"));

    mockMvc
        .perform(get("/stores/creators").with(owner("c@example.com")))
        // TS 의 category: string[] 는 required 다. null 이나 키 부재면 프론트가 깨진다.
        .andExpect(jsonPath("$.items[0].category").isArray())
        .andExpect(jsonPath("$.items[0].category.length()").value(0))
        .andExpect(jsonPath("$.items[0].performanceHistory").isArray());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/creators` 가 없어 401 또는 404.

- [ ] **Step 3: 공유 Embeddable 을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/creator/Performance.java`:

```java
package ai.adflow.api.store.creator;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * TS: CreatorPerformance. Creator.performanceHistory 와 CampaignEntry.performance 가 공유한다.
 *
 * @Embeddable 인 이유 — 한 타입이 @Entity 이면서 @Embeddable 일 수 없는데 양쪽에서 필요하다.
 * 임베더블로 두면 컬렉션 테이블(@ElementCollection)과 인라인(@Embedded) 양쪽으로 쓸 수 있다.
 */
@Embeddable
public class Performance {

  @Column(name = "campaign_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String campaignId;

  private Integer reach;
  private Integer clicks;
  private Integer conversions;
  private Double revenue;
  private Double cost;

  @Column(name = "recorded_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String recordedAt;

  public String getCampaignId() { return campaignId; }
  public void setCampaignId(String v) { this.campaignId = v; }
  public Integer getReach() { return reach; }
  public void setReach(Integer v) { this.reach = v; }
  public Integer getClicks() { return clicks; }
  public void setClicks(Integer v) { this.clicks = v; }
  public Integer getConversions() { return conversions; }
  public void setConversions(Integer v) { this.conversions = v; }
  public Double getRevenue() { return revenue; }
  public void setRevenue(Double v) { this.revenue = v; }
  public Double getCost() { return cost; }
  public void setCost(Double v) { this.cost = v; }
  public String getRecordedAt() { return recordedAt; }
  public void setRecordedAt(String v) { this.recordedAt = v; }
}
```

- [ ] **Step 4: 플랫폼 enum 을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/creator/CreatorPlatform.java`:

```java
package ai.adflow.api.store.creator;

/**
 * TS: CreatorPlatform = "instagram" | "youtube" | "tiktok" | "other".
 *
 * 상수명이 곧 와이어 값이라 소문자로 쓴다. 자바 관례(대문자)를 따르면 @JsonProperty 가 붙고
 * springdoc 이 내는 OpenAPI enum 값과 실제 JSON 값이 갈릴 위험이 생긴다.
 */
public enum CreatorPlatform {
  instagram,
  youtube,
  tiktok,
  other
}
```

- [ ] **Step 5: Creator 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/creator/Creator.java`:

```java
package ai.adflow.api.store.creator;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/entities/creator/model.ts 의 Creator 와 필드 1:1. */
@Entity
@Table(name = "creators")
public class Creator extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String handle;

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private CreatorPlatform platform;

  @Column(name = "display_name")
  private String displayName;

  @Column(name = "avatar_url", length = 2000)
  private String avatarUrl;

  // @OrderColumn 이 없으면 순서가 보장되지 않는다. 화면이 입력 순서를 그대로 보여주므로 필요하다.
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "creator_categories", joinColumns = @JoinColumn(name = "creator_id"))
  @Column(name = "category")
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<String> category = new ArrayList<>();

  @Column(name = "follower_count")
  private Integer followerCount;

  @Column(length = 2000)
  private String note;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "creator_performances",
      joinColumns = @JoinColumn(name = "creator_id"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<Performance> performanceHistory = new ArrayList<>();

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getHandle() { return handle; }
  public void setHandle(String v) { this.handle = v; }
  public CreatorPlatform getPlatform() { return platform; }
  public void setPlatform(CreatorPlatform v) { this.platform = v; }
  public String getDisplayName() { return displayName; }
  public void setDisplayName(String v) { this.displayName = v; }
  public String getAvatarUrl() { return avatarUrl; }
  public void setAvatarUrl(String v) { this.avatarUrl = v; }
  // TS 의 category: string[] 는 required 다. null 을 넣지 않는다 — 프론트가 .map 을 바로 부른다.
  public List<String> getCategory() { return category; }
  public void setCategory(List<String> v) { this.category = v == null ? new ArrayList<>() : v; }
  public Integer getFollowerCount() { return followerCount; }
  public void setFollowerCount(Integer v) { this.followerCount = v; }
  public String getNote() { return note; }
  public void setNote(String v) { this.note = v; }
  public List<Performance> getPerformanceHistory() { return performanceHistory; }
  public void setPerformanceHistory(List<Performance> v) {
    this.performanceHistory = v == null ? new ArrayList<>() : v;
  }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
```

- [ ] **Step 6: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/creator/CreatorRepository.java`:

```java
package ai.adflow.api.store.creator;

import ai.adflow.api.store.OwnerScopedRepository;

public interface CreatorRepository extends OwnerScopedRepository<Creator> {}
```

`apps/api/src/main/java/ai/adflow/api/store/creator/CreatorController.java`:

```java
package ai.adflow.api.store.creator;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/creators")
public class CreatorController extends StoreController<Creator> {

  public CreatorController(CreatorRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 29건 + `CreatorControllerTest` 3건 = **32건**.

`재저장하면_이전_컬렉션이_남지_않는다` 가 실패하면 `StoreController.upsert` 의 `flush()` 가 빠진 것이다 — delete 와 insert 가 같은 트랜잭션에서 순서 없이 나가면 컬렉션 테이블에 고아가 남는다.

- [ ] **Step 8: 실제 Postgres 에서 컬렉션 테이블을 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/store/creator/CreatorPostgresIT.java`:

```java
package ai.adflow.api.store.creator;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CreatorPostgresIT extends IntegrationTestBase {

  @Autowired private CreatorRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 컬렉션이_별도_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables).contains("creators", "creator_categories", "creator_performances");
  }

  @Test
  void 성과이력이_행으로_저장되고_순서가_보존된다() {
    Performance p1 = new Performance();
    p1.setCampaignId("camp_1");
    p1.setReach(1000);
    Performance p2 = new Performance();
    p2.setCampaignId("camp_2");
    p2.setReach(2000);

    Creator c = new Creator();
    c.setId("cr_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setHandle("@pg");
    c.setPlatform(CreatorPlatform.instagram);
    c.setCategory(new ArrayList<>(List.of("뷰티", "푸드")));
    c.setPerformanceHistory(new ArrayList<>(List.of(p1, p2)));
    repository.saveAndFlush(c);

    Integer rows =
        jdbc.queryForObject(
            "select count(*) from creator_performances where creator_id = 'cr_pg'", Integer.class);
    assertThat(rows).isEqualTo(2);

    assertThat(repository.findById("cr_pg").orElseThrow().getPerformanceHistory())
        .extracting(Performance::getCampaignId)
        .containsExactly("camp_1", "camp_2");
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 6건 (기존 4 + 신규 2).

- [ ] **Step 9: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/creators 정규화 — 카테고리·성과이력 컬렉션 테이블 분리"
```

---

## Task 5: InfluencerCampaign — 공유 Embeddable 의 컬럼 충돌

`InfluencerCampaign.entries: CampaignEntry[]` 를 컬렉션 테이블로 펼친다. `CampaignEntry` 안에 Task 4 의 `Performance` 가 인라인으로 들어간다.

**핵심 함정 (탐침으로 확인):** `campaign_entries` 테이블에 조인 컬럼 `campaign_id` 와 `Performance.campaignId` 의 `campaign_id` 가 동시에 매핑돼 Hibernate 가 부팅에서 죽는다 — `MappingException: Column 'campaign_id' is duplicated in mapping for collection`. `@AttributeOverride` 로 푼다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/campaign/CampaignStage.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/campaign/CampaignEntry.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaign.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaignRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaignController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/campaign/InfluencerCampaignControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/campaign/CampaignPostgresIT.java`

**Interfaces:**
- Consumes: Task 3 의 `OwnerScoped`·`StoreController`, Task 4 의 `Performance`
- Produces:
  - `enum CampaignStage { candidate, proposed, negotiating, producing, published, settled }`
  - `@Embeddable CampaignEntry` — `String creatorId`, `CampaignStage stage`, `String outreachDraft`, `String contentGuideline`, `String contentUrl`, `Performance performance`, `String paidAt`, `String updatedAt`
  - `@Entity InfluencerCampaign extends OwnerScoped`
  - `GET/POST/DELETE /stores/influencer-campaigns`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/campaign/InfluencerCampaignControllerTest.java`:

```java
package ai.adflow.api.store.campaign;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InfluencerCampaignControllerTest {

  private static final String ITEM =
      """
      {
        "id": "camp_1",
        "name": "여름 캠페인",
        "goal": "신규 유입",
        "budget": 3000000,
        "brandProfileId": "bp_1",
        "entries": [
          {
            "creatorId": "cr_1",
            "stage": "settled",
            "outreachDraft": "안녕하세요",
            "performance": {"campaignId": "camp_1", "reach": 5000, "revenue": 900000},
            "paidAt": "2026-06-20T00:00:00Z",
            "updatedAt": "2026-06-20T00:00:00Z"
          },
          {
            "creatorId": "cr_2",
            "stage": "negotiating",
            "updatedAt": "2026-06-21T00:00:00Z"
          }
        ],
        "createdAt": "2026-05-01T00:00:00Z"
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/influencer-campaigns")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 파이프라인_엔트리가_순서와_중첩까지_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].entries.length()").value(2))
        .andExpect(jsonPath("$.items[0].entries[0].creatorId").value("cr_1"))
        .andExpect(jsonPath("$.items[0].entries[0].stage").value("settled"))
        // 인라인 Performance 의 campaignId 가 조인 컬럼과 충돌하지 않고 값이 살아남아야 한다.
        .andExpect(jsonPath("$.items[0].entries[0].performance.campaignId").value("camp_1"))
        .andExpect(jsonPath("$.items[0].entries[0].performance.revenue").value(900000.0))
        .andExpect(jsonPath("$.items[0].entries[1].creatorId").value("cr_2"))
        .andExpect(jsonPath("$.items[0].entries[1].stage").value("negotiating"))
        // performance 는 optional 이라 키가 없어야 한다.
        .andExpect(jsonPath("$.items[0].entries[1].performance").doesNotExist())
        .andExpect(jsonPath("$.items[0].entries[1].paidAt").doesNotExist());
  }

  @Test
  void 엔트리를_줄여_저장하면_고아가_남지_않는다() throws Exception {
    save("b@example.com", ITEM);
    save("b@example.com", ITEM.replaceAll("(?s),\\s*\\{\\s*\"creatorId\": \"cr_2\".*?\\}", ""));

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("b@example.com")))
        .andExpect(jsonPath("$.items[0].entries.length()").value(1))
        .andExpect(jsonPath("$.items[0].entries[0].creatorId").value("cr_1"));
  }

  @Test
  void 빈_파이프라인도_배열로_나온다() throws Exception {
    // 텍스트 블록의 들여쓰기 제거 때문에 정규식으로 entries 를 비우면 위치에 따라 빗나간다.
    // 이 케이스가 보는 것은 "빈 배열이 null 로 뭉개지지 않는가" 하나뿐이라 최소 JSON 을 직접 쓴다.
    save(
        "c@example.com",
        """
        {
          "id": "camp_empty",
          "name": "빈 캠페인",
          "brandProfileId": "bp_1",
          "entries": [],
          "createdAt": "2026-05-01T00:00:00Z"
        }
        """);

    mockMvc
        .perform(get("/stores/influencer-campaigns").with(owner("c@example.com")))
        .andExpect(jsonPath("$.items[0].entries").isArray())
        .andExpect(jsonPath("$.items[0].entries.length()").value(0));
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/influencer-campaigns` 없음.

- [ ] **Step 3: 단계 enum 을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/campaign/CampaignStage.java`:

```java
package ai.adflow.api.store.campaign;

/**
 * TS: CampaignStage. 상수명이 곧 와이어 값이라 소문자로 쓴다.
 *
 * 선언 순서가 TS 의 STAGE_ORDER 와 같다 — 화면 표기(후보·제안함·…)는 프론트가 갖는다.
 */
public enum CampaignStage {
  candidate,
  proposed,
  negotiating,
  producing,
  published,
  settled
}
```

- [ ] **Step 4: CampaignEntry 를 만든다 — 컬럼 충돌 해소가 여기 있다**

`apps/api/src/main/java/ai/adflow/api/store/campaign/CampaignEntry.java`:

```java
package ai.adflow.api.store.campaign;

import ai.adflow.api.store.creator.Performance;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/entities/influencer-campaign/model.ts 의 CampaignEntry. */
@Embeddable
public class CampaignEntry {

  @Column(name = "creator_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String creatorId;

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private CampaignStage stage;

  @Column(name = "outreach_draft", length = 4000)
  private String outreachDraft;

  @Column(name = "content_guideline", length = 4000)
  private String contentGuideline;

  @Column(name = "content_url", length = 2000)
  private String contentUrl;

  /**
   * 컬렉션 테이블의 조인 컬럼이 campaign_id 인데 Performance 도 campaign_id 를 매핑해 충돌한다
   * (MappingException: Column 'campaign_id' is duplicated in mapping for collection).
   * 조인 컬럼 이름은 자연스러운 쪽을 지키고 임베더블 쪽을 옮긴다. 와이어는 그대로 campaignId 다.
   */
  @Embedded
  @AttributeOverride(name = "campaignId", column = @Column(name = "perf_campaign_id"))
  private Performance performance;

  @Column(name = "paid_at")
  private String paidAt;

  @Column(name = "updated_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String updatedAt;

  public String getCreatorId() { return creatorId; }
  public void setCreatorId(String v) { this.creatorId = v; }
  public CampaignStage getStage() { return stage; }
  public void setStage(CampaignStage v) { this.stage = v; }
  public String getOutreachDraft() { return outreachDraft; }
  public void setOutreachDraft(String v) { this.outreachDraft = v; }
  public String getContentGuideline() { return contentGuideline; }
  public void setContentGuideline(String v) { this.contentGuideline = v; }
  public String getContentUrl() { return contentUrl; }
  public void setContentUrl(String v) { this.contentUrl = v; }
  public Performance getPerformance() { return performance; }
  public void setPerformance(Performance v) { this.performance = v; }
  public String getPaidAt() { return paidAt; }
  public void setPaidAt(String v) { this.paidAt = v; }
  public String getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(String v) { this.updatedAt = v; }
}
```

- [ ] **Step 5: InfluencerCampaign 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaign.java`:

```java
package ai.adflow.api.store.campaign;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: InfluencerCampaign. Meta Campaign 과 별개 엔티티다 (ADR-065 §1). */
@Entity
@Table(name = "influencer_campaigns")
public class InfluencerCampaign extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  /** Meta objective 가 아니라 자유 텍스트/칩이다. enum 으로 좁히지 않는다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String goal;

  @Column(name = "product_id")
  private String productId;

  private Double budget;

  @Column(name = "start_date")
  private String startDate;

  @Column(name = "end_date")
  private String endDate;

  @Column(name = "brand_profile_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String brandProfileId;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "campaign_entries", joinColumns = @JoinColumn(name = "campaign_id"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<CampaignEntry> entries = new ArrayList<>();

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getGoal() { return goal; }
  public void setGoal(String v) { this.goal = v; }
  public String getProductId() { return productId; }
  public void setProductId(String v) { this.productId = v; }
  public Double getBudget() { return budget; }
  public void setBudget(Double v) { this.budget = v; }
  public String getStartDate() { return startDate; }
  public void setStartDate(String v) { this.startDate = v; }
  public String getEndDate() { return endDate; }
  public void setEndDate(String v) { this.endDate = v; }
  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  // TS 의 entries: CampaignEntry[] 는 required 다. isCampaignCompleted 가 .every 를 바로 부른다.
  public List<CampaignEntry> getEntries() { return entries; }
  public void setEntries(List<CampaignEntry> v) { this.entries = v == null ? new ArrayList<>() : v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
```

- [ ] **Step 6: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaignRepository.java`:

```java
package ai.adflow.api.store.campaign;

import ai.adflow.api.store.OwnerScopedRepository;

public interface InfluencerCampaignRepository extends OwnerScopedRepository<InfluencerCampaign> {}
```

`apps/api/src/main/java/ai/adflow/api/store/campaign/InfluencerCampaignController.java`:

```java
package ai.adflow.api.store.campaign;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/influencer-campaigns")
public class InfluencerCampaignController extends StoreController<InfluencerCampaign> {

  public InfluencerCampaignController(InfluencerCampaignRepository repository) {
    super(repository);
  }
}
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 32건 + `InfluencerCampaignControllerTest` 3건 = **35건**.

컨텍스트 로딩이 `Column 'campaign_id' is duplicated in mapping for collection` 으로 죽으면 Step 4 의 `@AttributeOverride` 가 빠진 것이다.

- [ ] **Step 8: 실제 Postgres 에서 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/store/campaign/CampaignPostgresIT.java`:

```java
package ai.adflow.api.store.campaign;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.store.creator.Performance;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class CampaignPostgresIT extends IntegrationTestBase {

  @Autowired private InfluencerCampaignRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 충돌_회피_컬럼이_실제로_두_개다() {
    List<String> columns =
        jdbc.queryForList(
            "select column_name from information_schema.columns where table_name = 'campaign_entries' order by 1",
            String.class);
    // 조인 컬럼과 임베더블 컬럼이 공존해야 한다.
    assertThat(columns).contains("campaign_id", "perf_campaign_id", "creator_id", "position");
  }

  @Test
  void 인라인_성과가_왕복한다() {
    Performance p = new Performance();
    p.setCampaignId("camp_pg");
    p.setRevenue(900000.0);

    CampaignEntry e = new CampaignEntry();
    e.setCreatorId("cr_1");
    e.setStage(CampaignStage.settled);
    e.setPerformance(p);
    e.setUpdatedAt("2026-06-20T00:00:00Z");

    InfluencerCampaign c = new InfluencerCampaign();
    c.setId("camp_pg");
    c.setOwnerKey("pg@example.com");
    c.setUpdatedAt(Instant.now());
    c.setName("여름");
    c.setEntries(new ArrayList<>(List.of(e)));
    repository.saveAndFlush(c);

    var found = repository.findById("camp_pg").orElseThrow();
    assertThat(found.getEntries()).hasSize(1);
    assertThat(found.getEntries().get(0).getPerformance().getCampaignId()).isEqualTo("camp_pg");
    assertThat(found.getEntries().get(0).getStage()).isEqualTo(CampaignStage.settled);
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 8건.

- [ ] **Step 9: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/influencer-campaigns 정규화 — 파이프라인 엔트리 · 인라인 성과 컬럼 충돌 해소"
```

---

## Task 6: BrandProfile — 린치핀 엔티티

가장 복잡하다. 세 가지 매핑 전략이 한 엔티티에 모인다.

| 필드 | 전략 | 이유 |
|---|---|---|
| `copyReferences` · `proofPoints` | `@ElementCollection` | 균질하고 중첩이 없다 |
| `goals` | `@OneToMany` 엔티티 | `leads` 가 중첩돼 있어 임베더블 컬렉션에 못 들어간다 (JPA 가 금지) |
| `goal` (deprecated) | `@Embedded` | 스칼라 2개 |
| `policy` | **JSON 텍스트 컬럼** | `SopSection` 이 이질적 판별 유니온이다 (위 §설계 문서와 다르게 가는 3가지 #1) |

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/JsonNodeConverter.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/CopyReference.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/CopySource.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/GoalMetric.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/LagTarget.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/LeadMetric.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/Goal.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfile.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfileRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfileController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/brand/BrandProfileControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/brand/BrandProfilePostgresIT.java`

**Interfaces:**
- Consumes: Task 3 의 `OwnerScoped`·`StoreController`
- Produces:
  - `@Converter JsonNodeConverter implements AttributeConverter<JsonNode, String>`
  - `@Embeddable CopyReference` (`String id`, `String text`, `CopySource source`, `String createdAt`)
  - `enum CopySource { ig, manual }` · `enum GoalMetric { roas, contribution, cpa }`
  - `@Embeddable LagTarget` (`GoalMetric metric`, `Double target`) · `@Embeddable LeadMetric` (`String kind`, `Double value`, `String source`, `String reason`)
  - `@Entity Goal` — 테이블 `brand_profile_goals`
  - `@Entity BrandProfile extends OwnerScoped`
  - `GET/POST/DELETE /stores/brand-profiles`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/brand/BrandProfileControllerTest.java`:

```java
package ai.adflow.api.store.brand;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BrandProfileControllerTest {

  // TS BrandProfileEntry 와 1:1. policy 는 이질 판별 유니온이라 그대로 왕복해야 한다.
  private static final String ITEM =
      """
      {
        "id": "bp_1",
        "name": "기본 프로필",
        "isDefault": true,
        "brandDescription": "매일의 루틴을 만드는 브랜드",
        "tone": "warm",
        "marginRate": 0.42,
        "proofPoints": ["재구매율 40%", "누적 12만 병"],
        "copyReferences": [
          {"id": "ref_1", "text": "아침을 바꾸는 한 잔", "source": "ig", "createdAt": "2026-05-01T00:00:00Z"},
          {"id": "ref_2", "text": "가볍게 시작해요", "source": "manual", "createdAt": "2026-05-02T00:00:00Z"}
        ],
        "goals": [
          {
            "id": "goal_1",
            "name": "여름 ROAS",
            "lag": {"metric": "roas", "target": 3.5},
            "leads": [
              {"kind": "cpc-max", "value": 900, "source": "derived"},
              {"kind": "ctr-min", "value": null, "source": "custom", "reason": "데이터 부족"}
            ],
            "periodDays": 30,
            "createdAt": "2026-05-01T00:00:00Z"
          }
        ],
        "policy": [
          {"type": "prohibited_words", "data": {"words": ["최저가", "1위"]}, "source": "user"},
          {"type": "length_limits", "data": {"headline": 40, "body": 125}}
        ]
      }
      """;

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/brand-profiles")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 정규화된_컬렉션이_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/brand-profiles").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("기본 프로필"))
        .andExpect(jsonPath("$.items[0].isDefault").value(true))
        .andExpect(jsonPath("$.items[0].marginRate").value(0.42))
        .andExpect(jsonPath("$.items[0].proofPoints[1]").value("누적 12만 병"))
        .andExpect(jsonPath("$.items[0].copyReferences[0].id").value("ref_1"))
        .andExpect(jsonPath("$.items[0].copyReferences[1].source").value("manual"))
        .andExpect(jsonPath("$.items[0].goals[0].lag.metric").value("roas"))
        .andExpect(jsonPath("$.items[0].goals[0].lag.target").value(3.5))
        .andExpect(jsonPath("$.items[0].goals[0].leads[0].kind").value("cpc-max"))
        .andExpect(jsonPath("$.items[0].goals[0].periodDays").value(30))
        // Goal 의 대리 PK 가 와이어로 새면 안 된다.
        .andExpect(jsonPath("$.items[0].goals[0].pk").doesNotExist());
  }

  @Test
  void value_가_null_인_리드는_키가_남는다() throws Exception {
    save("v@example.com", ITEM.replace("bp_1", "bp_v"));

    // TS 의 LeadMetric.value 는 number | null 이다 — optional 이 아니라서 키가 사라지면 안 된다.
    mockMvc
        .perform(get("/stores/brand-profiles").with(owner("v@example.com")))
        .andExpect(jsonPath("$.items[0].goals[0].leads[1].value").doesNotExist())
        .andExpect(jsonPath("$.items[0].goals[0].leads[1]").exists());
  }

  @Test
  void 판별유니온_policy_가_배열로_왕복한다() throws Exception {
    save("p@example.com", ITEM.replace("bp_1", "bp_p"));

    mockMvc
        .perform(get("/stores/brand-profiles").with(owner("p@example.com")))
        .andExpect(jsonPath("$.items[0].policy").isArray())
        .andExpect(jsonPath("$.items[0].policy[0].type").value("prohibited_words"))
        .andExpect(jsonPath("$.items[0].policy[0].data.words[0]").value("최저가"))
        .andExpect(jsonPath("$.items[0].policy[1].data.headline").value(40))
        // 두 번째 항목엔 source 가 없다. 옵셔널이 임의로 채워지면 안 된다.
        .andExpect(jsonPath("$.items[0].policy[1].source").doesNotExist());
  }

  @Test
  void 목표를_지워_저장하면_자식_행도_사라진다() throws Exception {
    save("g@example.com", ITEM.replace("bp_1", "bp_g"));
    // 텍스트 블록의 들여쓰기 제거 때문에 정규식으로 goals 를 비우면 위치에 따라 빗나간다.
    // 같은 id 로 목표 없는 문서를 다시 저장한다 — 자식 행이 고아로 남는지가 확인 대상이다.
    save(
        "g@example.com",
        """
        {
          "id": "bp_g",
          "name": "기본 프로필",
          "goals": []
        }
        """);

    mockMvc
        .perform(get("/stores/brand-profiles").with(owner("g@example.com")))
        .andExpect(jsonPath("$.items[0].goals.length()").value(0))
        .andExpect(jsonPath("$.items.length()").value(1));
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `/stores/brand-profiles` 없음.

- [ ] **Step 3: JSON 컬럼 컨버터를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/JsonNodeConverter.java`:

```java
package ai.adflow.api.store;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * 구조를 서버가 해석하지 않는 필드를 JSON 텍스트로 왕복시킨다.
 *
 * jsonb 가 아니라 text 인 이유 — 단위 테스트가 H2 라 jsonb 를 못 쓴다. 이 값으로 질의하지
 * 않으므로 text 로 충분하다. 질의가 필요해지면 컬럼 타입만 jsonb 로 올리면 된다.
 *
 * JsonNode 로 들고 있어야 Jackson 이 문자열이 아니라 원래 구조(배열·객체)로 직렬화한다.
 *
 * 패키지가 tools.jackson 인 것에 주의 — Spring Boot 4 의 HTTP 메시지 컨버터는 Jackson 3 을 쓴다.
 * 클래스패스에 Jackson 2 도 함께 있어서 com.fasterxml.jackson.databind.JsonNode 를 쓰면 컴파일은
 * 되지만 런타임에 HttpMessageConversionException 으로 죽는다. (애노테이션 @JsonIgnore·@JsonInclude
 * 는 Jackson 3 도 com.fasterxml.jackson.annotation 을 그대로 쓴다.)
 */
@Converter
public class JsonNodeConverter implements AttributeConverter<JsonNode, String> {

  private static final ObjectMapper MAPPER = JsonMapper.builder().build();

  @Override
  public String convertToDatabaseColumn(JsonNode node) {
    return node == null ? null : node.toString();
  }

  @Override
  public JsonNode convertToEntityAttribute(String stored) {
    if (stored == null) return null;
    try {
      return MAPPER.readTree(stored);
    } catch (Exception e) {
      throw new IllegalStateException("저장된 JSON 을 읽지 못했어요. 값이 손상됐어요.", e);
    }
  }
}
```

- [ ] **Step 4: 값 타입들을 만든다**

`apps/api/src/main/java/ai/adflow/api/store/brand/CopySource.java`:

```java
package ai.adflow.api.store.brand;

/** TS: CopyReference["source"] = "ig" | "manual". */
public enum CopySource {
  ig,
  manual
}
```

`apps/api/src/main/java/ai/adflow/api/store/brand/GoalMetric.java`:

```java
package ai.adflow.api.store.brand;

/** TS: GoalMetric = "roas" | "contribution" | "cpa". */
public enum GoalMetric {
  roas,
  contribution,
  cpa
}
```

`apps/api/src/main/java/ai/adflow/api/store/brand/CopyReference.java`:

```java
package ai.adflow.api.store.brand;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: CopyReference. id 는 클라이언트가 만든 값이지 PK 가 아니다 — 컬렉션 원소라 PK 가 없다. */
@Embeddable
public class CopyReference {

  @Column(name = "reference_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String id;

  @Column(length = 4000)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String text;

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private CopySource source;

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getText() { return text; }
  public void setText(String v) { this.text = v; }
  public CopySource getSource() { return source; }
  public void setSource(CopySource v) { this.source = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
```

`apps/api/src/main/java/ai/adflow/api/store/brand/LagTarget.java`:

```java
package ai.adflow.api.store.brand;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: LagTarget = { metric: GoalMetric; target: number }. deprecated AccountGoal 도 같은 형태다. */
@Embeddable
public class LagTarget {

  @Enumerated(EnumType.STRING)
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private GoalMetric metric;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Double target;

  public GoalMetric getMetric() { return metric; }
  public void setMetric(GoalMetric v) { this.metric = v; }
  public Double getTarget() { return target; }
  public void setTarget(Double v) { this.target = v; }
}
```

`apps/api/src/main/java/ai/adflow/api/store/brand/LeadMetric.java`:

```java
package ai.adflow.api.store.brand;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** TS: LeadMetric = { kind; value: number | null; source; reason? }. */
@Embeddable
public class LeadMetric {

  /**
   * "cpc-max"·"ctr-min" 은 하이픈이 있어 자바 enum 상수명이 될 수 없다. String 으로 두고
   * 허용값은 스키마에만 적는다 — 생성 TS 타입이 유니온이 되도록.
   */
  @Schema(allowableValues = {"cpc-max", "ctr-min"}, requiredMode = Schema.RequiredMode.REQUIRED)
  private String kind;

  /**
   * TS 에서 number | null 이다 — optional 이 아니라 "null 을 명시하는" 필드다.
   * 전역 non_null 정책의 예외로 두지 않으면 키가 사라져 undefined 가 된다.
   */
  // VALUE 는 H2 예약어라 컬럼명을 바꾼다(LibraryItem.primary 와 같은 부류).
  // Jackson 은 자바 프로퍼티명을 쓰므로 와이어는 그대로 "value" 다.
  @JsonInclude(JsonInclude.Include.ALWAYS)
  @Column(name = "lead_value")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private Double value;

  @Schema(allowableValues = {"derived", "custom"}, requiredMode = Schema.RequiredMode.REQUIRED)
  private String source;

  @Column(length = 1000)
  private String reason;

  public String getKind() { return kind; }
  public void setKind(String v) { this.kind = v; }
  public Double getValue() { return value; }
  public void setValue(Double v) { this.value = v; }
  public String getSource() { return source; }
  public void setSource(String v) { this.source = v; }
  public String getReason() { return reason; }
  public void setReason(String v) { this.reason = v; }
}
```

- [ ] **Step 5: Goal 엔티티를 만든다**

`leads` 가 중첩 컬렉션이라 `Goal` 은 임베더블이 될 수 없다 — JPA 는 `@ElementCollection` 원소 안의 컬렉션을 허용하지 않는다. 엔티티로 올린다.

`apps/api/src/main/java/ai/adflow/api/store/brand/Goal.java`:

```java
package ai.adflow.api.store.brand;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * TS: Goal. leads 가 중첩 컬렉션이라 @Embeddable 로는 안 되고 엔티티여야 한다.
 *
 * 도메인 id 는 클라이언트가 만든 문자열이고 owner 간 유일성이 보장되지 않는다. PK 로 쓰면
 * 다른 사용자의 같은 id 와 충돌하므로 대리 키를 따로 둔다 — 와이어에는 노출하지 않는다.
 */
@Entity
@Table(name = "brand_profile_goals")
public class Goal {

  @JsonIgnore
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long pk;

  @Column(name = "goal_id")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String id;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Embedded
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private LagTarget lag;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "brand_profile_goal_leads", joinColumns = @JoinColumn(name = "goal_pk"))
  @OrderColumn(name = "position")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private List<LeadMetric> leads = new ArrayList<>();

  @Column(name = "period_days")
  private Integer periodDays;

  @Column(name = "created_at")
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String createdAt;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public LagTarget getLag() { return lag; }
  public void setLag(LagTarget v) { this.lag = v; }
  public List<LeadMetric> getLeads() { return leads; }
  public void setLeads(List<LeadMetric> v) { this.leads = v == null ? new ArrayList<>() : v; }
  public Integer getPeriodDays() { return periodDays; }
  public void setPeriodDays(Integer v) { this.periodDays = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}
```

- [ ] **Step 6: BrandProfile 엔티티를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfile.java`:

```java
package ai.adflow.api.store.brand;

import ai.adflow.api.store.JsonNodeConverter;
import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.media.Schema;

/** TS: apps/web/src/features/brand-profile/model/useBrandProfileStorage.ts 의 BrandProfileEntry. */
@Entity
@Table(name = "brand_profiles")
public class BrandProfile extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Column(name = "is_default")
  private Boolean isDefault;

  @Column(name = "brand_description", length = 4000)
  private String brandDescription;

  private String tone;

  @Column(name = "brand_voice", length = 4000)
  private String brandVoice;

  @Column(name = "customer_voice_summary", length = 4000)
  private String customerVoiceSummary;

  @Column(name = "image_guide", length = 4000)
  private String imageGuide;

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "brand_profile_copy_references",
      joinColumns = @JoinColumn(name = "brand_profile_id"))
  @OrderColumn(name = "position")
  private List<CopyReference> copyReferences = new ArrayList<>();

  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "brand_profile_proof_points",
      joinColumns = @JoinColumn(name = "brand_profile_id"))
  @Column(name = "text", length = 1000)
  @OrderColumn(name = "position")
  private List<String> proofPoints = new ArrayList<>();

  @Column(name = "margin_rate")
  private Double marginRate;

  /** @deprecated goals 로 흡수됐지만 기존 데이터가 있어 와이어에 남겨둔다. */
  @Embedded
  @AttributeOverride(name = "metric", column = @Column(name = "legacy_goal_metric"))
  @AttributeOverride(name = "target", column = @Column(name = "legacy_goal_target"))
  private LagTarget goal;

  @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  @JoinColumn(name = "brand_profile_id")
  @OrderColumn(name = "position")
  private List<Goal> goals = new ArrayList<>();

  /**
   * SopSection[] — type 마다 data 형태가 다른 판별 유니온이라 관계형으로 펼치지 않는다
   * (설계 §5 대비 의도된 편차). 조회 조건으로 쓰이지 않아 잃는 것이 없다.
   *
   * 스키마를 손으로 적어주지 않으면 springdoc 이 JsonNode 의 빈 프로퍼티(isArray·isNull…)를
   * 그대로 노출해 계약이 거짓말을 한다. 서버가 해석하지 않는 값이므로 "객체 배열"까지만 말한다.
   */
  @ArraySchema(schema = @Schema(implementation = Object.class))
  @Convert(converter = JsonNodeConverter.class)
  @Column(name = "policy", columnDefinition = "text")
  private JsonNode policy;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public Boolean getIsDefault() { return isDefault; }
  public void setIsDefault(Boolean v) { this.isDefault = v; }
  public String getBrandDescription() { return brandDescription; }
  public void setBrandDescription(String v) { this.brandDescription = v; }
  public String getTone() { return tone; }
  public void setTone(String v) { this.tone = v; }
  public String getBrandVoice() { return brandVoice; }
  public void setBrandVoice(String v) { this.brandVoice = v; }
  public String getCustomerVoiceSummary() { return customerVoiceSummary; }
  public void setCustomerVoiceSummary(String v) { this.customerVoiceSummary = v; }
  public String getImageGuide() { return imageGuide; }
  public void setImageGuide(String v) { this.imageGuide = v; }
  public List<CopyReference> getCopyReferences() { return copyReferences; }
  public void setCopyReferences(List<CopyReference> v) {
    this.copyReferences = v == null ? new ArrayList<>() : v;
  }
  public List<String> getProofPoints() { return proofPoints; }
  public void setProofPoints(List<String> v) { this.proofPoints = v == null ? new ArrayList<>() : v; }
  public Double getMarginRate() { return marginRate; }
  public void setMarginRate(Double v) { this.marginRate = v; }
  public LagTarget getGoal() { return goal; }
  public void setGoal(LagTarget v) { this.goal = v; }
  public List<Goal> getGoals() { return goals; }
  public void setGoals(List<Goal> v) { this.goals = v == null ? new ArrayList<>() : v; }
  public JsonNode getPolicy() { return policy; }
  public void setPolicy(JsonNode v) { this.policy = v; }
}
```

`isDefault` 의 접근자 이름에 주의한다. `Boolean` 에 `getIsDefault()` 를 써야 Jackson 이 `isDefault` 로 직렬화한다. `boolean` + `isDefault()` 로 쓰면 와이어가 `default` 가 되어 깨진다.

- [ ] **Step 7: 리포지토리와 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfileRepository.java`:

```java
package ai.adflow.api.store.brand;

import ai.adflow.api.store.OwnerScopedRepository;

public interface BrandProfileRepository extends OwnerScopedRepository<BrandProfile> {}
```

`apps/api/src/main/java/ai/adflow/api/store/brand/BrandProfileController.java`:

```java
package ai.adflow.api.store.brand;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/brand-profiles")
public class BrandProfileController extends StoreController<BrandProfile> {

  public BrandProfileController(BrandProfileRepository repository) {
    super(repository);
  }
}
```

`StoreController.upsert` 의 `deleteByIdAndOwnerKey` 는 **파생 삭제**라 Spring Data 가 엔티티를 읽어 `em.remove()` 를 부른다 — 그래서 `goals` 의 cascade·orphanRemoval 이 동작한다. 성능을 이유로 `@Modifying @Query("delete from ...")` 로 바꾸면 **자식 행이 고아로 남는다.** 바꾸지 말 것.

- [ ] **Step 8: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 35건 + `BrandProfileControllerTest` 4건 = **39건**.

`value_가_null_인_리드는_키가_남는다` 가 실패하면 `LeadMetric.value` 의 `@JsonInclude(ALWAYS)` 가 빠진 것이다.

- [ ] **Step 9: 실제 Postgres 에서 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/store/brand/BrandProfilePostgresIT.java`:

```java
package ai.adflow.api.store.brand;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

class BrandProfilePostgresIT extends IntegrationTestBase {

  private static final String POLICY =
      "[{\"type\":\"prohibited_words\",\"data\":{\"words\":[\"최저가\"]},\"source\":\"user\"}]";

  @Autowired private BrandProfileRepository repository;
  @Autowired private JdbcTemplate jdbc;

  private BrandProfile sample(String id, String owner) throws Exception {
    LeadMetric lead = new LeadMetric();
    lead.setKind("cpc-max");
    lead.setValue(900.0);
    lead.setSource("derived");

    LagTarget lag = new LagTarget();
    lag.setMetric(GoalMetric.roas);
    lag.setTarget(3.5);

    Goal goal = new Goal();
    goal.setId("goal_1");
    goal.setName("여름 ROAS");
    goal.setLag(lag);
    goal.setLeads(new ArrayList<>(List.of(lead)));

    CopyReference ref = new CopyReference();
    ref.setId("ref_1");
    ref.setText("아침을 바꾸는 한 잔");
    ref.setSource(CopySource.ig);

    BrandProfile bp = new BrandProfile();
    bp.setId(id);
    bp.setOwnerKey(owner);
    bp.setUpdatedAt(Instant.now());
    bp.setName("기본 프로필");
    bp.setIsDefault(true);
    bp.setCopyReferences(new ArrayList<>(List.of(ref)));
    bp.setProofPoints(new ArrayList<>(List.of("재구매율 40%")));
    bp.setGoals(new ArrayList<>(List.of(goal)));
    bp.setPolicy(JsonMapper.builder().build().readTree(POLICY));
    return bp;
  }

  @Test
  void 애그리거트가_다섯_테이블로_펼쳐진다() {
    List<String> tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema='public' order by 1",
            String.class);
    assertThat(tables)
        .contains(
            "brand_profiles",
            "brand_profile_copy_references",
            "brand_profile_proof_points",
            "brand_profile_goals",
            "brand_profile_goal_leads");
  }

  @Test
  void 판별유니온_policy_가_텍스트로_왕복한다() throws Exception {
    repository.saveAndFlush(sample("bp_pg", "pg@example.com"));

    var found = repository.findById("bp_pg").orElseThrow();
    assertThat(found.getPolicy().isArray()).isTrue();
    assertThat(found.getPolicy().get(0).get("data").get("words").get(0).asText()).isEqualTo("최저가");
    assertThat(found.getGoals().get(0).getLeads().get(0).getKind()).isEqualTo("cpc-max");
  }

  // 파생 삭제는 트랜잭션이 있어야 한다. 프로덕션 경로는 StoreController 가 @Transactional 이라
  // 문제없고, 리포지토리를 직접 부르는 이 테스트만 트랜잭션을 연다.
  @Test
  @Transactional
  void 프로필을_지우면_자식_행이_함께_사라진다() throws Exception {
    repository.saveAndFlush(sample("bp_del", "del@example.com"));
    assertThat(jdbc.queryForObject("select count(*) from brand_profile_goals", Integer.class))
        .isGreaterThan(0);

    repository.deleteByIdAndOwnerKey("bp_del", "del@example.com");
    repository.flush();

    // 파생 삭제라 cascade 가 돈다. @Modifying @Query 로 바꾸면 이 테스트가 깨진다.
    assertThat(
            jdbc.queryForObject(
                "select count(*) from brand_profile_goals g"
                    + " where not exists (select 1 from brand_profiles p where p.id = g.brand_profile_id)",
                Integer.class))
        .isEqualTo(0);
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 11건.

- [ ] **Step 10: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/brand-profiles 정규화 — 목표·레퍼런스 테이블 분리 · policy 는 JSON 컬럼 존치"
```

---

## Task 7: Next.js 라우트 4개를 Spring 프록시로 교체

여기서 Supabase 의존 4개가 사라진다. `createSyncedStore` 의 계약을 그대로 두었으므로 **프론트 store 코드와 도메인 타입은 한 줄도 바뀌지 않는다.**

JWT 는 NextAuth 세션 JWT 안에만 있으므로 라우트가 `getToken()` 으로 직접 꺼낸다 — `getServerSession()` 의 `Session` 에는 일부러 넣지 않았다(설계 §4).

**access 토큰 만료 처리:** 백엔드가 401 을 주면 refresh 토큰으로 한 번 재발급해 재시도한다. 새 토큰을 세션 쿠키에 다시 심지는 않는다 — 라우트 핸들러에서 쿠키를 갱신하려면 NextAuth 콜백 타이밍에 얽혀야 하는데, 만료 후 매 요청이 왕복 한 번을 더 하는 비용이 로컬 전용 백엔드에서는 무의미하기 때문이다. `ponytail:` 왕복이 문제가 되면 `callbacks.jwt` 에서 선제 갱신을 추가한다.

**Files:**
- Modify: `apps/web/src/shared/lib/backend/exchange.ts`
- Create: `apps/web/src/shared/lib/backend/refresh.ts`
- Create: `apps/web/src/shared/lib/backend/stores.ts`
- Create: `apps/web/src/shared/lib/backend/stores.test.ts`
- Modify: `apps/web/types/next-auth.d.ts`
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/app/api/stores/brand-profiles/route.ts`
- Modify: `apps/web/app/api/stores/library/route.ts`
- Modify: `apps/web/app/api/stores/creators/route.ts`
- Modify: `apps/web/app/api/stores/influencer-campaigns/route.ts`

**Interfaces:**
- Consumes: Task 1 의 `POST /auth/refresh`, Task 3~6 의 `/stores/*`
- Produces:
  - `BackendToken = { token: string; expiresAt: string; refreshToken: string; refreshExpiresAt: string }` (`exchange.ts` 에서 export)
  - `refreshBackendToken(refreshToken: string): Promise<BackendToken | null>`
  - `createStoreRoute(path: string)` → `{ GET, POST, DELETE }` — 각각 `(req: NextRequest) => Promise<NextResponse>`
  - 세션 JWT 필드 `backendRefreshToken?: string`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/shared/lib/backend/stores.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTokenMock = vi.fn();
vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));

import { createStoreRoute } from "./stores";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function req(method: string, url = "http://localhost:3000/api/stores/library") {
  return new Request(url, {
    method,
    ...(method === "POST"
      ? { body: JSON.stringify({ item: { id: "a" } }), headers: { "content-type": "application/json" } }
      : {}),
  }) as unknown as Parameters<ReturnType<typeof createStoreRoute>["GET"]>[0];
}

describe("createStoreRoute", () => {
  beforeEach(() => {
    process.env.ADFLOW_BACKEND_URL = "http://localhost:8080";
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    getTokenMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.ADFLOW_BACKEND_URL;
    else process.env.ADFLOW_BACKEND_URL = ORIGINAL_URL;
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("세션이 없으면 401 이고 백엔드를 부르지 않아요", async () => {
    getTokenMock.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("둘러보기 게스트는 백엔드를 부르지 않아요", async () => {
    getTokenMock.mockResolvedValue({ email: "guest@adflow.local", backendToken: "jwt-abc" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("백엔드 URL 이 없으면 503 이에요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(503);
  });

  it("GET 은 Bearer 토큰을 실어 백엔드로 넘기고 본문을 그대로 돌려줘요", async () => {
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "a" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const res = await createStoreRoute("/stores/library").GET(req("GET"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [{ id: "a" }] });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/stores/library");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-abc");
  });

  it("DELETE 는 id 쿼리를 그대로 넘겨요", async () => {
    getTokenMock.mockResolvedValue({ email: "a@x.com", backendToken: "jwt-abc" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await createStoreRoute("/stores/library").DELETE(
      req("DELETE", "http://localhost:3000/api/stores/library?id=cre_1"),
    );

    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:8080/stores/library?id=cre_1");
  });

  it("401 이면 refresh 로 한 번 재발급해 재시도해요", async () => {
    getTokenMock.mockResolvedValue({
      email: "a@x.com",
      backendToken: "expired",
      backendRefreshToken: "refresh-abc",
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "fresh",
            expiresAt: "2026-08-01T00:00:00Z",
            refreshToken: "refresh-next",
            refreshExpiresAt: "2026-09-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const res = await createStoreRoute("/stores/library").GET(req("GET"));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[1][0]).toBe("http://localhost:8080/auth/refresh");
    expect(
      (fetchSpy.mock.calls[2][1]?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer fresh");
  });

  it("재발급도 실패하면 401 을 그대로 돌려줘요", async () => {
    getTokenMock.mockResolvedValue({
      email: "a@x.com",
      backendToken: "expired",
      backendRefreshToken: "refresh-abc",
    });
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const res = await createStoreRoute("/stores/library").GET(req("GET"));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/backend/stores.test.ts
```

기대: FAIL — `./stores` 모듈이 없어 import 에러.

- [ ] **Step 3: 교환 응답 타입에 refresh 를 더한다**

`apps/web/src/shared/lib/backend/exchange.ts` 의 `BackendToken` 을 바꾼다.

```ts
export type BackendToken = {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
};
```

- [ ] **Step 4: 갱신 모듈을 만든다**

`apps/web/src/shared/lib/backend/refresh.ts`:

```ts
import { backendBaseUrl, internalSecret } from "./client";
import type { BackendToken } from "./exchange";

// 무상태 갱신 — 서버가 토큰을 기억하지 않으므로 refresh 토큰만 있으면 된다.
// 실패해도 던지지 않는다. 호출부가 null 을 받고 원래의 401 을 그대로 흘린다.
export async function refreshBackendToken(refreshToken: string): Promise<BackendToken | null> {
  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) return null;

  try {
    const res = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      console.error("[backend] 토큰 갱신 실패", res.status);
      return null;
    }
    return (await res.json()) as BackendToken;
  } catch (e) {
    console.error("[backend] 토큰 갱신 중 오류", e);
    return null;
  }
}
```

- [ ] **Step 5: 저장소 프록시를 만든다**

`apps/web/src/shared/lib/backend/stores.ts`:

```ts
// Synced Store 라우트 4개의 공통 프록시. server-side only.
//
// Spring JWT 는 NextAuth 세션 JWT 안에만 있고 브라우저로 내려가지 않는다(설계 §4).
// 그래서 라우트가 getToken() 으로 직접 꺼내 Authorization 헤더에 싣는다.

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl } from "./client";
import { refreshBackendToken } from "./refresh";

type Handler = (req: NextRequest) => Promise<NextResponse>;

async function call(
  base: string,
  path: string,
  search: string,
  method: string,
  token: string,
  body: string | undefined,
): Promise<Response> {
  return fetch(`${base}${path}${search}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body }),
  });
}

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // 게스트·미로그인은 여기 오지 않는다(createSyncedStore 가 단락). 방어적 차단이다.
  if (!jwt || !isRealOwner(jwt.email as string | null | undefined) || !jwt.backendToken) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const base = backendBaseUrl();
  if (!base) {
    // 배포 환경(둘러보기 전용)은 백엔드 URL 을 안 준다 — 설계 §7 의 자동 휴면.
    return NextResponse.json(
      { error: "이 환경에서는 저장 기능을 쓸 수 없어요. 둘러보기 전용이에요." },
      { status: 503 },
    );
  }

  const search = req.nextUrl?.search ?? new URL(req.url).search;
  const body = req.method === "POST" ? await req.text() : undefined;

  let res = await call(base, path, search, req.method, jwt.backendToken as string, body);

  // access 토큰은 1시간이다. 만료되면 한 번만 재발급해 재시도한다.
  if (res.status === 401 && jwt.backendRefreshToken) {
    const issued = await refreshBackendToken(jwt.backendRefreshToken as string);
    if (issued) {
      res = await call(base, path, search, req.method, issued.token, body);
    }
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`[backend] ${req.method} ${path} 실패`, res.status, text.slice(0, 200));
  }
  return new NextResponse(text || null, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export function createStoreRoute(path: string): { GET: Handler; POST: Handler; DELETE: Handler } {
  const handler: Handler = (req) => proxy(req, path);
  return { GET: handler, POST: handler, DELETE: handler };
}
```

- [ ] **Step 6: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/backend/stores.test.ts
```

기대: PASS, 7건.

- [ ] **Step 7: 세션에 refresh 토큰을 보관한다**

`apps/web/types/next-auth.d.ts` 의 `JWT` 인터페이스에 한 줄을 더한다.

```ts
    backendToken?: string
    backendTokenExpiresAt?: string
    backendRefreshToken?: string
```

`apps/web/lib/auth.ts` 의 교환 결과 처리 블록을 바꾼다.

```ts
          if (issued) {
            token.backendToken = issued.token
            token.backendTokenExpiresAt = issued.expiresAt
            token.backendRefreshToken = issued.refreshToken
          }
```

- [ ] **Step 8: 라우트 4개를 교체한다**

각 파일을 통째로 아래로 바꾼다. `path` 만 다르다.

`apps/web/app/api/stores/library/route.ts`:

```ts
// ADR-046 Synced Store API(library_items) — 단계 2 에서 Supabase 직결을 Spring 프록시로 교체.
// 계약(GET → {items}, POST {item}, DELETE ?id=)은 그대로라 createSyncedStore 는 바뀌지 않는다.

import { createStoreRoute } from "@shared/lib/backend/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handlers = createStoreRoute("/stores/library");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
```

`apps/web/app/api/stores/brand-profiles/route.ts` — 첫 줄 주석의 테이블명을 `brand_profiles` 로, 경로를 `"/stores/brand-profiles"` 로.

`apps/web/app/api/stores/creators/route.ts` — `creators`, `"/stores/creators"`.

`apps/web/app/api/stores/influencer-campaigns/route.ts` — `influencer_campaigns`, `"/stores/influencer-campaigns"`.

- [ ] **Step 9: 전체 회귀를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
```

기대: tsc 에러 0 · 기존 680 + 신규 7 = `Tests 687 passed` · build 성공.

`supabase-server` import 가 사라져 쓰이지 않는 모듈이 생겼는지 확인한다. **지우지는 않는다** — 단계 3~4 의 다른 라우트가 아직 쓴다.

```bash
grep -rln "getSupabaseServer" apps/web/app apps/web/lib apps/web/src | sort
```

기대: `app/api/stores/*` 4개가 목록에서 사라졌다.

- [ ] **Step 10: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "feat(web): Synced Store 라우트 4개를 Spring 프록시로 교체 — 만료 시 refresh 재시도"
```

---

## Task 8: 쓰기 실패를 삼키지 않는다

`createSyncedStore` 의 `postItem`·`removeById` 가 지금 `.catch(() => {})` 로 에러를 완전히 삼킨다. `supabase-sync.ts` 의 `.then(() => {}, () => {})` 와 같은 함정이고, persona 미러가 몇 달간 조용히 실패한 원인이다. **이 단계의 핵심 원칙이 여기 있다.**

**Files:**
- Modify: `apps/web/src/shared/ui/Toast.tsx`
- Modify: `apps/web/src/shared/lib/store/createSyncedStore.ts`
- Modify: `apps/web/src/shared/lib/store/index.ts`
- Modify: `apps/web/src/features/brand-profile/model/brandProfileStore.ts`
- Modify: `apps/web/src/shared/lib/store/createSyncedStore.test.ts`

**Interfaces:**
- Consumes: Task 7 의 프록시 라우트(비-OK 응답을 실제로 내려줌)
- Produces:
  - `useToastOptional(): ((message: string) => void) | null` — Provider 밖에서 null
  - `SyncedState<T>` 에 `lastError: string | null` 과 `clearError: () => void` 추가
  - `useSyncErrorToast(store)` — `SyncedStore` 배럴에서 export. `lastError` 를 토스트로 흘리고 비운다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/shared/lib/store/createSyncedStore.test.ts` 의 `describe("createSyncedStore", ...)` 블록 안 끝에 붙인다.

```ts
  it("쓰기가 실패하면 lastError 로 드러나요", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    useStore.getState().add({ id: "a", v: 1 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());
    // 로컬 값은 그대로 남는다 — 저장은 실패해도 사용자가 쓴 내용을 지우지 않는다.
    expect(useStore.getState().items).toHaveLength(1);
  });

  it("네트워크가 끊겨도 lastError 로 드러나요", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    useStore.getState().removeById("a");
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());
  });

  it("다음 쓰기가 성공하면 lastError 가 비워져요", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");

    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    useStore.getState().add({ id: "a", v: 1 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    useStore.getState().add({ id: "b", v: 2 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeNull());
  });

  it("게스트는 쓰기를 단락하므로 에러도 안 생겨요", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("guest@adflow.local");
    useStore.getState().add({ id: "a", v: 1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useStore.getState().lastError).toBeNull();
  });
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/store/createSyncedStore.test.ts
```

기대: FAIL — `lastError` 가 `undefined` 라 `toBeTruthy()`·`toBeNull()` 이 깨진다.

- [ ] **Step 3: Provider 밖에서도 안전한 토스트 접근자를 만든다**

`apps/web/src/shared/ui/Toast.tsx` 의 `useToast` 아래에 붙인다.

```tsx
// Provider 밖(테스트 렌더·비인증 셸)에서도 터지지 않는 변형. store 배선처럼
// 토스트가 있으면 좋지만 없다고 화면이 죽으면 안 되는 자리에서 쓴다.
export function useToastOptional(): ((message: string) => void) | null {
  const ctx = useContext(ToastContext);
  return ctx ? ctx.showToast : null;
}
```

- [ ] **Step 4: 에러를 상태로 올린다**

`apps/web/src/shared/lib/store/createSyncedStore.ts` 를 아래대로 고친다.

`SyncedState` 인터페이스에 두 줄을 더한다.

```ts
export interface SyncedState<T extends SyncedItem> {
  items: T[];
  status: SyncStatus;
  owner: string | null;
  // 마지막 서버 쓰기의 실패 사유. 성공하면 null 로 돌아간다.
  lastError: string | null;
  add: (item: T) => void;
  upsert: (item: T) => void;
  removeById: (id: string) => void;
  setAll: (items: T[]) => void;
  clearError: () => void;
  hydrate: (owner: string | null) => Promise<void>;
}
```

`postItem` 과 상태 초기값·`removeById` 를 바꾼다.

```ts
      (set, get) => {
        // 서버 확정. 실패를 삼키지 않는다 — supabase-sync 의 .then(()=>{},()=>{}) 가
        // persona 미러 실패를 몇 달간 숨긴 전례가 있다(설계 §5).
        const settle = (res: Response | null, action: string) => {
          if (res && res.ok) {
            if (get().lastError) set({ lastError: null });
            return;
          }
          const detail = res ? ` (${res.status})` : "";
          set({ lastError: `${action}이 서버에 닿지 않았어요${detail}. 잠시 뒤 다시 시도해 주세요.` });
        };

        const postItem = (item: T) => {
          if (!isRealOwner(get().owner)) return;
          void fetch(config.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ item }),
          }).then(
            (res) => settle(res, "저장"),
            () => settle(null, "저장"),
          );
        };

        return {
        items: [],
        status: "idle",
        owner: null,
        lastError: null,

        setAll: (items) => set({ items }),

        clearError: () => set({ lastError: null }),
```

`removeById` 를 바꾼다.

```ts
        removeById: (id) => {
          set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
          if (isRealOwner(get().owner)) {
            void fetch(`${config.endpoint}?id=${encodeURIComponent(id)}`, {
              method: "DELETE",
            }).then(
              (res) => settle(res, "삭제"),
              () => settle(null, "삭제"),
            );
          }
        },
```

- [ ] **Step 5: 토스트 배선을 붙인다**

같은 파일 상단 import 에 더한다.

```ts
import { useToastOptional } from "@shared/ui/Toast";
```

`useSync` 를 바꾼다.

```ts
  function useSync() {
    const { data: session } = useSession();
    const owner = session?.user?.email ?? null;
    useEffect(() => {
      // persist 캐시 먼저 복원(오프라인 폴백) → 그 위에 서버 하이드레이션.
      void useStore.persist.rehydrate();
      void useStore.getState().hydrate(owner);
    }, [owner]);
    useSyncErrorToast(useStore);
  }
```

같은 파일 아래쪽, `createSyncedStore` **밖**에 훅을 만들고 export 한다.

```ts
// 쓰기 실패를 화면으로 흘린다. 훅이라 도메인 store 가 자체 useSync 를 쓰더라도 재사용된다.
export function useSyncErrorToast<T extends SyncedItem>(
  useStore: UseBoundStore<StoreApi<SyncedState<T>>>,
): void {
  const showToast = useToastOptional();
  const lastError = useStore((s) => s.lastError);
  useEffect(() => {
    if (!lastError) return;
    if (showToast) showToast(lastError);
    else console.error("[synced-store]", lastError);
    useStore.getState().clearError();
  }, [lastError, showToast, useStore]);
}
```

- [ ] **Step 6: 배럴과 도메인 store 에 연결한다**

`apps/web/src/shared/lib/store/index.ts` 의 export 줄을 바꾼다.

```ts
export { createSyncedStore, useSyncErrorToast } from "./createSyncedStore";
```

`apps/web/src/features/brand-profile/model/brandProfileStore.ts` 는 팩토리의 `useSync` 를 쓰지 않고 자체 훅을 갖는다. 배선을 따로 붙인다.

import 를 바꾸고,

```ts
import { createSyncedStore, isRealOwner, useSyncErrorToast } from "@shared/lib/store";
```

`useSyncBrandProfiles` 의 `useEffect` 블록 **다음**에 한 줄을 더한다.

```ts
  useSyncErrorToast(useStore);
}
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
```

기대: tsc 에러 0 · 기존 687 + 신규 4 = `Tests 691 passed`.

- [ ] **Step 8: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "fix(web): Synced Store 쓰기 실패를 삼키지 않고 상태·토스트로 노출"
```

---

## Task 9: 계약 재생성 + 타입 호환성 검사

와이어를 동결했다고 선언했으니 **컴파일러가 그것을 지키게** 만든다. 생성된 OpenAPI 타입을 기존 도메인 타입에 대입해보고, 대입이 안 되면 빌드가 깨지게 한다.

**Files:**
- Create: `apps/web/src/shared/lib/backend/contract-compat.ts`
- Modify: `packages/contracts/openapi.json` (생성물)
- Modify: `packages/contracts/types/api.d.ts` (생성물)

**Interfaces:**
- Consumes: Task 3~6 의 엔드포인트, `@adflow/contracts/types/api`
- Produces: `contract-compat.ts` — 타입 수준 단언만 있는 파일. 런타임 코드 없음.

- [ ] **Step 1: Spring 을 띄우고 계약을 재생성한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose up -d postgres
cd apps/api
ADFLOW_JWT_SECRET='<로컬 값>' \
ADFLOW_INTERNAL_SECRET='<로컬 값>' \
ADFLOW_ENCRYPTION_KEY='<로컬 32자>' \
./gradlew bootRun --args='--spring.profiles.active=local' > /tmp/spring-bootrun.log 2>&1 &
sleep 30 && curl -sSf http://localhost:8080/actuator/health
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta && npm run contracts:generate
```

- [ ] **Step 2: 새 경로와 스키마가 실제로 들어갔는지 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
grep -oE '"/(stores/[a-z-]+|auth/refresh)"' packages/contracts/openapi.json | sort -u
grep -oE '"(LibraryItem|Creator|InfluencerCampaign|BrandProfile|CampaignEntry|Performance|Goal|LeadMetric)"' packages/contracts/openapi.json | sort -u
```

기대: 경로 5개(`/stores/brand-profiles`·`/stores/creators`·`/stores/influencer-campaigns`·`/stores/library`·`/auth/refresh`)와 스키마 이름들이 나온다.

- [ ] **Step 3: 하이픈 enum 이 스키마에 실렸는지 확인한다**

`LeadMetric.kind` 는 자바 enum 이 아니라 `@Schema(allowableValues=...)` 로 처리했다. springdoc 이 이것을 `enum` 으로 내는지 **여기서 실측한다.**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
python3 -c "
import json
s=json.load(open('packages/contracts/openapi.json'))['components']['schemas']
print('LeadMetric.kind →', s['LeadMetric']['properties']['kind'])
print('CampaignEntry.stage →', s['CampaignEntry']['properties']['stage'])
"
```

기대: `kind` 에 `'enum': ['cpc-max', 'ctr-min']` 이 있다.

**없으면** — springdoc 이 `allowableValues` 를 무시한 것이다. 대체 수단은 필드에 `@Schema(type = "string", allowableValues = {...})` 대신 `@Schema(implementation = String.class, allowableValues = {...})` 를 쓰거나, 그래도 안 되면 **Step 5 의 호환성 단언에서 `kind` 만 예외로 두고 그 사실을 이 계획서에 기록한다.** 없는 것을 있는 척하지 말 것.

- [ ] **Step 4: 호환성 단언 파일을 만든다**

`apps/web/src/shared/lib/backend/contract-compat.ts`:

```ts
// 와이어 형태 동결의 강제 장치. 런타임 코드가 없고 타입 단언만 있다.
//
// Spring 이 내는 스키마(생성 타입)를 프론트 도메인 타입에 대입해본다. 백엔드가 필드를
// 빠뜨리거나 타입을 바꾸면 tsc 가 여기서 깨진다 — 화면에서 undefined 를 만나기 전에.
//
// 방향에 주의: "생성 → 도메인" 이다. 응답을 도메인 타입 자리에 안전하게 쓸 수 있는가를 본다.

import type { components } from "@adflow/contracts/types/api";
import type { BrandProfileEntry } from "@features/brand-profile/model/useBrandProfileStorage";
import type { Creator } from "@entities/creator/model";
import type { InfluencerCampaign } from "@entities/influencer-campaign/model";
import type { LibraryItem } from "@shared/lib/library";

type Api<K extends keyof components["schemas"]> = components["schemas"][K];

type Assert<T extends true> = T;
type AssignableTo<From, To> = [From] extends [To] ? true : false;

export type LibraryItemIsCompatible = Assert<AssignableTo<Api<"LibraryItem">, LibraryItem>>;
export type CreatorIsCompatible = Assert<AssignableTo<Api<"Creator">, Creator>>;
export type CampaignIsCompatible = Assert<
  AssignableTo<Api<"InfluencerCampaign">, InfluencerCampaign>
>;

// policy 만 예외다. SopSection 은 type 마다 data 형태가 달라지는 판별 유니온이고, 서버는 그 값을
// 해석하지 않고 JSON 텍스트로 왕복시키기만 한다(설계 문서 대비 의도된 편차 #1). OpenAPI 로 그
// 유니온을 표현할 수 없으므로 계약이 지켜주지 못하는 유일한 필드다.
//
// 대신 policy 를 뺀 나머지 전 필드는 여기서 검증된다. policy 의 왕복 자체는
// BrandProfileControllerTest.판별유니온_policy_가_배열로_왕복한다 와
// BrandProfilePostgresIT.판별유니온_policy_가_텍스트로_왕복한다 가 런타임으로 지킨다.
export type BrandProfileIsCompatible = Assert<
  AssignableTo<Omit<Api<"BrandProfile">, "policy">, Omit<BrandProfileEntry, "policy">>
>;
```

- [ ] **Step 5: 컴파일해서 실제 불일치를 찾는다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
```

**여기서 에러가 나는 것이 정상이다.** 이 Task 의 값은 에러가 알려주는 불일치에 있다. 나오는 대로 고친다. 예상되는 종류와 처방:

| 증상 | 원인 | 처방 |
|---|---|---|
| 생성 타입의 필드가 `string \| undefined` 인데 도메인은 `string` | Java 쪽이 nullable 로 잡혔다 | 해당 필드에 `@Schema(requiredMode = RequiredMode.REQUIRED)` |
| `policy` 가 `Record<string, never>` | `JsonNode` 를 springdoc 이 모른다 | 필드에 `@Schema(type = "array", implementation = Object.class)` |
| `stage` 가 `string` | enum 이 아니라 문자열로 잡혔다 | `@Enumerated` 필드가 자바 enum 인지 확인 |
| `savedAt` 이 `number` 아닌 `string` | `Long` 이 `int64` → 생성기가 string 으로 낸 것 | `openapi-typescript` 기본 동작. 도메인 타입이 `number` 이므로 Java 타입을 `Long` 유지하되 `@Schema(type = "number", format = "double")` 로 조정 |

**고칠 때 원칙:** 프론트의 `src/` 타입은 건드리지 않는다. 항상 Java 쪽 스키마 표현을 맞춘다. 프론트 타입을 고쳐서 통과시키면 와이어 동결이 무너진다.

Java 를 고쳤으면 `./gradlew bootRun` 을 다시 띄우고 Step 1 부터 반복한다.

- [ ] **Step 6: 통과를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json && echo "계약 호환 OK"
npm run build
```

기대: 에러 0, `계약 호환 OK` 출력, build 성공.

- [ ] **Step 7: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web packages/contracts apps/api
git commit -m "chore(contracts): 단계 2 엔드포인트 반영 · 생성 타입↔도메인 타입 호환성 컴파일 검사"
```

---

## Task 10: 로컬 통합 확인

여기까지는 조각별 검증이다. 이 Task 는 **두 프로세스를 실제로 붙여** HTTP 로 확인한다.

단계 1 에서 컨트롤러의 400 이 실제 HTTP 에서 401 로 뒤바뀌는 결함이 MockMvc 를 통과했다. MockMvc 는 ERROR 디스패치를 재현하지 않는다. **이 Task 를 건너뛰지 말 것.**

**Files:** 없음 (검증 전용). 문제가 나오면 해당 Task 로 돌아간다.

**Interfaces:**
- Consumes: Task 1~9 전부

- [ ] **Step 1: 두 프로세스를 띄운다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose up -d postgres
cd apps/api
ADFLOW_JWT_SECRET='<로컬 값>' \
ADFLOW_INTERNAL_SECRET='<로컬 값>' \
ADFLOW_ENCRYPTION_KEY='<로컬 32자>' \
./gradlew bootRun --args='--spring.profiles.active=local' > /tmp/spring-bootrun.log 2>&1 &
sleep 30 && curl -sSf http://localhost:8080/actuator/health && echo
```

- [ ] **Step 2: 정규화된 테이블이 실제로 생겼는지 본다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose exec -T postgres psql -U adflow -d adflow -c "\dt"
```

기대: `meta_connections` 외에 아래가 보인다 — `library_items`, `creators`, `creator_categories`, `creator_performances`, `influencer_campaigns`, `campaign_entries`, `brand_profiles`, `brand_profile_copy_references`, `brand_profile_proof_points`, `brand_profile_goals`, `brand_profile_goal_leads`. **테이블 11개.**

- [ ] **Step 3: 토큰을 받는다**

```bash
SECRET='<내부 시크릿>'
RESP=$(curl -sS -X POST http://localhost:8080/auth/exchange \
  -H "Content-Type: application/json" -H "X-Internal-Secret: $SECRET" \
  -d '{"ownerKey":"me@example.com","email":"me@example.com","role":"팀장","metaConnection":{"accessToken":"EAAG-x"}}')
echo "$RESP"
TOKEN=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['token'])" "$RESP")
REFRESH=$(python3 -c "import json,sys;print(json.loads(sys.argv[1])['refreshToken'])" "$RESP")
```

기대: 응답에 `token`·`expiresAt`·`refreshToken`·`refreshExpiresAt` 4개가 있다.

- [ ] **Step 4: refresh 토큰이 Bearer 로 통하지 않는지 확인한다 — 이게 Task 1 의 요지다**

```bash
echo "--- access 로 조회 (200 기대) ---"
curl -sS -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8080/stores/library
echo "--- refresh 로 조회 (401 기대) ---"
curl -sS -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $REFRESH" http://localhost:8080/stores/library
echo "--- refresh 로 갱신 (200 기대) ---"
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" -H "X-Internal-Secret: $SECRET" \
  -d "{\"refreshToken\":\"$REFRESH\"}"
echo "--- access 로 갱신 (401 기대) ---"
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" -H "X-Internal-Secret: $SECRET" \
  -d "{\"refreshToken\":\"$TOKEN\"}"
```

기대: `200` · `401` · `200` · `401`.

- [ ] **Step 5: 실제 HTTP 로 저장·조회·삭제를 돌린다 (ERROR 디스패치 확인 포함)**

```bash
echo "--- 토큰 없이 (401 기대) ---"
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/stores/creators

echo "--- id 없는 저장 (400 기대 — 401 로 뒤바뀌면 SecurityConfig 회귀) ---"
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/stores/creators \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"handle":"@noid"}}'

echo "--- 정상 저장 ---"
curl -sS -X POST http://localhost:8080/stores/creators \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"id":"cr_curl","handle":"@curl","platform":"instagram","category":["뷰티","푸드"],"performanceHistory":[{"campaignId":"c1","reach":100}],"createdAt":"2026-07-01T00:00:00Z"}}'
echo

echo "--- 조회 (와이어 형태 눈으로 확인) ---"
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/stores/creators | python3 -m json.tool

echo "--- 삭제 ---"
curl -sS -X DELETE "http://localhost:8080/stores/creators?id=cr_curl" -H "Authorization: Bearer $TOKEN"
echo
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/stores/creators
echo
```

기대: `401` · **`400`** · `{"ok":true}` · `ownerKey`·`updatedAt` 이 없고 `category`·`performanceHistory` 가 배열인 JSON · `{"ok":true}` · `{"items":[]}`

**두 번째가 `401` 이면 단계 1 에서 고친 `dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()` 이 회귀한 것이다.**

- [ ] **Step 6: 컬렉션이 실제로 정규화돼 저장됐는지 DB 에서 본다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
curl -sS -X POST http://localhost:8080/stores/brand-profiles \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"item":{"id":"bp_curl","name":"컬","proofPoints":["a","b"],"copyReferences":[{"id":"r1","text":"t","source":"ig","createdAt":"2026-07-01T00:00:00Z"}],"goals":[{"id":"g1","name":"목표","lag":{"metric":"roas","target":3},"leads":[{"kind":"cpc-max","value":900,"source":"derived"}],"createdAt":"2026-07-01T00:00:00Z"}],"policy":[{"type":"prohibited_words","data":{"words":["최저가"]}}]}}'
echo

docker compose exec -T postgres psql -U adflow -d adflow -c \
  "select 'proof' t, count(*) from brand_profile_proof_points
   union all select 'refs', count(*) from brand_profile_copy_references
   union all select 'goals', count(*) from brand_profile_goals
   union all select 'leads', count(*) from brand_profile_goal_leads;"
docker compose exec -T postgres psql -U adflow -d adflow -c \
  "select left(policy, 60) from brand_profiles where id = 'bp_curl';"
```

기대: `proof 2` · `refs 1` · `goals 1` · `leads 1`. `policy` 는 JSON 배열 문자열.

- [ ] **Step 7: 프론트를 붙여 실제 사용 경로를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta && npm run dev
```

브라우저에서 Facebook 으로 로그인한 뒤:

1. Brand Profile 을 하나 만들고 저장한다
2. **다른 브라우저(또는 시크릿 창)로 같은 계정 로그인** → 방금 만든 프로필이 보이면 서버가 진실의 원천이다
3. Spring 을 `Ctrl+C` 로 내리고 프로필을 하나 더 만든다 → **"저장이 서버에 닿지 않았어요" 토스트가 떠야 한다** (Task 8 의 요지)
4. Spring 을 다시 띄우고 새로고침 → 3에서 만든 것은 로컬에만 있으므로 사라진다. 로컬 값이 지워지지 않고 남아 있었는지가 아니라 **실패를 알렸는지**가 확인 대상이다

- [ ] **Step 8: 둘러보기가 Spring 을 호출하지 않는지 확인한다 — 설계 §7 의 요구사항**

로그아웃하고 `/login` 에서 **둘러보기**로 들어간 뒤 Brand Profile·Creator·Library 화면을 모두 돌아본다.

```bash
grep -cE "GET /stores|POST /stores|auth/exchange|auth/refresh" /tmp/spring-bootrun.log
```

기대: 둘러보기 진입 이후 증가분 **0**. (Step 1~7 에서 쌓인 건수는 미리 세어두고 차이를 본다.)

- [ ] **Step 9: 최종 회귀를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
cd apps/api && ./gradlew test --no-daemon 2>&1 | tail -3
./gradlew integrationTest --no-daemon 2>&1 | tail -3
```

기대: tsc 0 · Vitest 691 · build 성공 · `test` 39건 · `integrationTest` 11건.

- [ ] **Step 10: Docker 없이도 기본 테스트가 도는지 마지막으로 확인한다**

```bash
docker compose down
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon 2>&1 | tail -3
```

기대: PASS 39건. Docker 를 내렸는데도 통과해야 한다.

- [ ] **Step 11: 커밋**

이 Task 는 코드 변경이 없다. Step 5·9 에서 문제를 고쳤다면 해당 Task 의 커밋 메시지 규칙을 따라 커밋한다. 없으면 커밋하지 않는다.

---

## 완료 조건

- [ ] `cd apps/api && ./gradlew test` green (**39건**), **Docker 없이도 통과**
- [ ] `cd apps/api && ./gradlew integrationTest` green (**11건**), 실제 PostgreSQL 16
- [ ] `npm test` → **691 tests** green (기존 680 + 신규 11), 65+ files
- [ ] `npm run build` 성공 · `tsc` 에러 0
- [ ] Postgres 에 정규화 테이블 **11개** 생성
- [ ] `POST /auth/refresh` — refresh 로 갱신 200, access 로 갱신 401
- [ ] refresh 토큰을 Bearer 로 쓰면 보호 경로가 **401**
- [ ] `/stores/*` 4개 — 토큰 없으면 401, id 없는 저장은 **실제 HTTP 에서 400**
- [ ] 응답 JSON 에 `ownerKey`·`updatedAt` 이 없고 optional 미설정 필드는 키가 없다
- [ ] `LeadMetric.value` 가 null 일 때 **키는 남는다**
- [ ] `contract-compat.ts` 가 컴파일된다 (생성 타입 → 도메인 타입 대입 가능)
- [ ] `app/api/stores/*` 4개에서 `getSupabaseServer` 가 사라졌다
- [ ] 프론트 `src/` 의 도메인 타입 선언이 **한 줄도 바뀌지 않았다**
- [ ] Spring 을 내린 상태에서 저장하면 **"서버에 닿지 않았어요" 토스트가 뜬다**
- [ ] 둘러보기 모드에서 `/stores/*`·`/auth/*` 호출 **0건**
- [ ] 커밋 8개, Task 단위

## 이 단계에서 하지 않는 것

- **레거시 미러 4개(`sops`·`personas`·`auto_relaunch_states`·`campaign_launches`)의 Tier 1 승격** — 단계 3. 이 4개는 아직 브라우저에서 anon 키로 Supabase 에 직접 쓴다.
- `supabase-sync.ts` 의 `.then(() => {}, () => {})` 제거 — 위 4개가 쓰는 동안은 남는다. 단계 3 에서 모듈째 사라진다.
- **나머지 테이블·스토리지 버킷** — 단계 4.
- **토너먼트 정규화·엔진 Java 포팅** — 단계 5.
- **`@Version` 낙관적 락** — 매핑은 검증해뒀다. 폴러와 UI 가 같은 행을 다투는 단계 5 에서 켠다.
- **Flyway** — 배포를 결정하는 시점까지 `ddl-auto: update`. 설계 §10 부채 그대로.
- **`callbacks.jwt` 선제 토큰 갱신** — 지금은 401 후 재시도만 한다. 왕복이 문제가 되면 붙인다.
- **기존 Supabase 데이터 이사** — 단계 7 의 ETL. 단계 2 를 마치면 로컬 Spring 이 빈 상태로 시작한다.
- **역할을 사용자별로 다르게 주는 흐름** — 모든 로그인이 여전히 `팀장` 이다.

## 자기 점검 결과

계획을 다 쓴 뒤 설계 문서와 대조했다.

**설계 §9 단계 2 항목("Synced Store 4개 정규화 + 엔드포인트, 프론트 어댑터 교체") 대비 누락 없음** — 4개 엔티티는 Task 3~6, 엔드포인트는 각 Task 의 컨트롤러, 프론트 어댑터는 Task 7.

**설계 §5 대비 차이 1건** — `policy_sections` 테이블이 없다. 위 §"설계 문서와 다르게 가는 3가지" #1 에 근거를 적었다. 테이블 수는 설계가 암시한 약 8개 대신 **11개**가 됐다(컬렉션 테이블이 예상보다 많다).

**설계 §8 대비 반영** — Testcontainers 는 Task 2. `@WithMockUser` 대신 `SecurityMockMvcRequestPostProcessors.jwt()` 를 쓴다(단계 1 선례). OpenAPI 계약 드리프트 검출은 Task 9.

**계획 작성 시 미해결로 남겼던 1건 — 구현에서 해소됨.** `LeadMetric.kind` 의 하이픈 enum 은 `@Schema(allowableValues = {"cpc-max","ctr-min"})` 로 스펙에 정상 반영됐다(`enum: ['cpc-max','ctr-min']`). 대체 수단이 필요 없었다.

**대신 계약이 지켜주지 못하는 것 1건이 남았다** — `BrandProfile.policy`. `SopSection` 은 판별 유니온이라 OpenAPI 로 표현할 수 없다. `contract-compat.ts` 는 `policy` 를 뺀 전 필드를 검증하고, `policy` 의 왕복은 `BrandProfileControllerTest.판별유니온_policy_가_배열로_왕복한다` 와 `BrandProfilePostgresIT.판별유니온_policy_가_텍스트로_왕복한다` 가 런타임으로 지킨다. 이 예외는 `contract-compat.ts` 안에 이유와 함께 적혀 있다.

---

## 미해결 사용자 액션 (계획 밖)

- **Vercel 대시보드 → Settings → General → Root Directory 를 `apps/web` 으로 변경.** 단계 0 이사 이후 배포 빌드가 깨진 상태다. 에이전트가 할 수 없다.
