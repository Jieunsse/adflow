# 단계 1 — Spring Security + 토큰 교환 + Meta 연결 암호화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spring 이 자체 JWT 를 발급·검증하고 역할 기반 인가를 강제하며, Meta 액세스 토큰을 암호화해 `meta_connections` 에 영속한다. Next.js 는 로그인 후 그 토큰을 받아 서버에만 보관한다.

**Architecture:** Spring 은 JWT 리소스 서버가 된다. 로그인은 계속 NextAuth 가 하고(Meta OAuth 는 거기서만 나온다), Next.js 서버가 내부 시크릿으로 `/auth/exchange` 를 호출해 Spring JWT 를 받아온다. 발급받은 JWT 는 NextAuth 세션 안에만 보관하고 브라우저로 내려보내지 않는다. 게스트(둘러보기)는 교환을 타지 않으므로 Spring 을 한 번도 호출하지 않는다.

**Tech Stack:** Spring Boot 4.1.0 · Spring Security 7.1.0 · nimbus-jose-jwt 10.9 · JDK 21 · H2(테스트) / PostgreSQL 16(로컬) · Next.js 16 · Vitest

## Global Constraints

- **Spring Boot 4.1.0 / Spring Security 7.1.0 기준.** Boot 3 예제를 그대로 옮기면 깨진다. 이 계획의 import 경로는 전부 실제 컴파일로 검증한 것이다.
- 단계 1 종료 시 **프론트 데이터는 여전히 Supabase 로 동작한다.** Spring 은 신원만 안다.
- **676 Vitest green 유지** (64 파일). 신규 테스트만 늘어난다.
- `npm run build` · `npx tsc --noEmit --project apps/web/tsconfig.json` 성공 유지.
- `cd apps/api && ./gradlew test` 는 **Docker 없이** green 이어야 한다 (H2 인메모리).
- 시크릿은 환경변수로만. 소스·`application.yml` 에 실값 금지.
- 커밋 메시지는 `type(scope): 한국어 설명`. `Co-Authored-By:` 트레일러 금지.
- 커밋 전 `git branch --show-current` 확인 (현재 `dev`). `git push` 금지.
- 새 의존성은 이 계획에 명시된 3개만: `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server`, `spring-security-test`.

## 설계 문서와 다르게 가는 2가지 (검토 요청)

설계 문서 `docs/superpowers/specs/2026-07-25-spring-backend-migration-design.md` 대비 두 곳을 바꾼다. 둘 다 단순화이며 되돌릴 수 있다.

**1. refresh 토큰을 만들지 않는다.** 설계는 "access + refresh" 였다. 그런데 이 JWT 를 들고 있는 주체는 브라우저가 아니라 **Next.js 서버**이고, 그 서버는 내부 시크릿과 Meta 토큰을 이미 갖고 있어 **언제든 `/auth/exchange` 를 다시 호출할 수 있다.** refresh 토큰은 "재인증 수단이 없는 클라이언트"를 위한 장치인데 여기엔 해당하지 않는다. 만료되면 재교환한다. access 토큰 수명은 1시간.

**2. 역할 이름을 JWT 클레임에서 ASCII 로 쓴다.** 도메인 어휘는 `팀장`·`팀원·게재`·`팀원·검토` 그대로 두되, JWT 클레임과 Spring authority 에서는 `LEAD`·`MEMBER_PUBLISH`·`MEMBER_REVIEW` 를 쓴다. 한글을 authority 문자열로 쓰면 `hasRole("팀장")` 매칭·로그·디버깅에서 인코딩 함정이 생긴다. 변환은 한 곳(`Role` enum)에만 둔다. **화면 표기는 바뀌지 않는다.**

## 실측으로 확인된 사실 (탐침 결과)

계획을 쓰기 전 `apps/api` 에서 실제로 컴파일해 확인했다. 아래는 추정이 아니다.

| 확인 항목 | 결과 |
|---|---|
| `spring-boot-starter-oauth2-resource-server` | 4.1.0 으로 해석. Spring Security 7.1.0, nimbus-jose-jwt 10.9 |
| `NimbusJwtDecoder.withSecretKey(SecretKeySpec)` | 사용 가능 |
| `new NimbusJwtEncoder(new ImmutableSecret<>(byte[]))` | 사용 가능 |
| `@EnableMethodSecurity` | `org.springframework.security.config.annotation.method.configuration` |
| `Customizer` | `org.springframework.security.config.Customizer` |
| `csrf(AbstractHttpConfigurer::disable)` | 사용 가능 |
| `oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))` | 사용 가능 |
| `JwtAuthenticationConverter` / `JwtGrantedAuthoritiesConverter` | `...oauth2.server.resource.authentication` |
| jakarta `AttributeConverter` + `JpaRepository` | 사용 가능 |

---

## File Structure

**apps/api — 신규**

| 경로 | 책임 |
|---|---|
| `src/main/java/ai/adflow/api/security/SecurityConfig.java` | 필터체인·공개 경로·리소스 서버 배선 |
| `src/main/java/ai/adflow/api/security/JwtConfig.java` | HS256 encoder/decoder 빈, authority 변환기 |
| `src/main/java/ai/adflow/api/security/Role.java` | 도메인 역할 ↔ ASCII authority 매핑 (단일 소스) |
| `src/main/java/ai/adflow/api/security/TokenIssuer.java` | JWT 발급 (클레임 구성·만료) |
| `src/main/java/ai/adflow/api/connection/MetaConnection.java` | 엔티티 |
| `src/main/java/ai/adflow/api/connection/MetaConnectionRepository.java` | 리포지토리 |
| `src/main/java/ai/adflow/api/connection/EncryptedStringConverter.java` | AES-GCM 컬럼 암호화 |
| `src/main/java/ai/adflow/api/auth/AuthExchangeController.java` | `POST /auth/exchange` |
| `src/main/java/ai/adflow/api/auth/ExchangeRequest.java` | 요청 DTO |
| `src/main/java/ai/adflow/api/auth/ExchangeResponse.java` | 응답 DTO |
| `src/main/java/ai/adflow/api/auth/InternalSecretGuard.java` | 내부 시크릿 검증 |
| `src/main/java/ai/adflow/api/me/MeController.java` | `GET /me`, `DELETE /me/meta-connection` (인가 검증용) |

**apps/web — 신규·수정**

| 경로 | 책임 |
|---|---|
| `src/shared/lib/backend/client.ts` | Spring 호출 단일 통로. 미설정이면 null 반환(휴면) |
| `src/shared/lib/backend/exchange.ts` | 교환 요청 조립 + 게스트 차단 |
| `src/shared/lib/backend/exchange.test.ts` | 게스트·미설정 차단 검증 |
| `lib/auth.ts` | `callbacks.jwt` 에서 교환 호출, 결과를 세션 JWT 에 보관 |
| `types/next-auth.d.ts` | `backendToken`·`backendTokenExpiresAt` 필드 |
| `.env.example` | 신규 환경변수 4개 문서화 |

---

## Task 1: Spring Security 기반 — JWT 리소스 서버

**Files:**
- Modify: `apps/api/build.gradle.kts`
- Create: `apps/api/src/main/java/ai/adflow/api/security/Role.java`
- Create: `apps/api/src/main/java/ai/adflow/api/security/JwtConfig.java`
- Create: `apps/api/src/main/java/ai/adflow/api/security/SecurityConfig.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Modify: `apps/api/src/test/resources/application-test.yml`
- Test: `apps/api/src/test/java/ai/adflow/api/security/SecurityConfigTest.java`

**Interfaces:**
- Consumes: 없음 (단계 1 첫 작업)
- Produces:
  - `Role` enum — 상수 `LEAD`, `MEMBER_PUBLISH`, `MEMBER_REVIEW`. 메서드 `String authority()` (예: `"LEAD"`), `String displayName()` (예: `"팀장"`), 정적 `Role fromDisplayName(String)`, `Role fromAuthority(String)`.
  - 빈 `JwtEncoder jwtEncoder`, `JwtDecoder jwtDecoder`, `JwtAuthenticationConverter jwtAuthenticationConverter`
  - 공개 경로: `/actuator/**`, `/v3/api-docs/**`, `/swagger-ui/**`, `/auth/exchange`. 그 외 전부 인증 필요.

- [ ] **Step 1: 의존성 3개 추가**

`apps/api/build.gradle.kts` 의 `dependencies` 블록에서 `implementation("org.springdoc:...")` 바로 아래에 두 줄, `testImplementation` 무리에 한 줄을 넣는다.

```kotlin
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
```

```kotlin
	testImplementation("org.springframework.security:spring-security-test")
```

- [ ] **Step 2: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/security/SecurityConfigTest.java`:

```java
package ai.adflow.api.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void 헬스는_인증없이_열려있다() throws Exception {
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  void api_docs는_인증없이_열려있다() throws Exception {
    mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
  }

  @Test
  void 보호된_경로는_토큰없이_401() throws Exception {
    mockMvc.perform(get("/me")).andExpect(status().isUnauthorized());
  }
}
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL. 시큐리티 스타터만 추가하면 Spring Security 기본 설정이 켜져 `/actuator/health` 까지 막히거나(401), `JwtDecoder` 빈이 없어 컨텍스트 로딩이 실패한다. 어느 쪽이든 red 다.

- [ ] **Step 4: Role enum 작성**

`apps/api/src/main/java/ai/adflow/api/security/Role.java`:

```java
package ai.adflow.api.security;

import java.util.Arrays;

/**
 * 도메인 역할 ↔ Spring authority 매핑의 단일 소스.
 *
 * 화면·도메인 어휘는 한글(팀장/팀원·게재/팀원·검토)이지만 JWT 클레임과 authority 는 ASCII 를 쓴다.
 * 한글을 authority 로 쓰면 hasRole 매칭·로그·디버깅에서 인코딩 함정이 생긴다.
 */
public enum Role {
  LEAD("팀장"),
  MEMBER_PUBLISH("팀원·게재"),
  MEMBER_REVIEW("팀원·검토");

  private final String displayName;

  Role(String displayName) {
    this.displayName = displayName;
  }

  public String authority() {
    return name();
  }

  public String displayName() {
    return displayName;
  }

  public static Role fromDisplayName(String value) {
    return Arrays.stream(values())
        .filter(r -> r.displayName.equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 역할이에요: " + value));
  }

  public static Role fromAuthority(String value) {
    return Arrays.stream(values())
        .filter(r -> r.name().equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 authority 예요: " + value));
  }
}
```

- [ ] **Step 5: JwtConfig 작성**

`apps/api/src/main/java/ai/adflow/api/security/JwtConfig.java`:

```java
package ai.adflow.api.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** HS256 대칭키 서명. 발급자와 검증자가 모두 이 서비스라 비대칭키가 필요 없다. */
@Configuration
public class JwtConfig {

  public static final String ROLES_CLAIM = "roles";

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

  @Bean
  JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withSecretKey(key).build();
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

- [ ] **Step 6: SecurityConfig 작성**

`apps/api/src/main/java/ai/adflow/api/security/SecurityConfig.java`:

```java
package ai.adflow.api.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationConverter converter)
      throws Exception {
    http
        // 브라우저가 직접 호출하지 않는다(Next.js 서버 전용). 세션도 쿠키도 쓰지 않는 무상태 API.
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    // 교환은 JWT 를 받기 전 단계다. 내부 시크릿으로 따로 지킨다.
                    .requestMatchers("/auth/exchange")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(o -> o.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)));
    return http.build();
  }
}
```

- [ ] **Step 7: 설정에 시크릿 자리 추가**

`apps/api/src/main/resources/application.yml` 의 `app:` 블록을 아래로 바꾼다 (기존 `poller` 항목은 유지).

```yaml
app:
  jwt:
    # HS256 서명키. 32바이트 이상. 실값은 환경변수 ADFLOW_JWT_SECRET 로만 준다.
    secret: ${ADFLOW_JWT_SECRET:}
    # 액세스 토큰 수명. 만료되면 Next.js 가 /auth/exchange 를 다시 호출한다(refresh 토큰 없음).
    ttl: PT1H
  poller:
    # 운영 기본값 6시간. 로컬 프로필에서 짧게 덮어쓴다 (설계 §6).
    interval: PT6H
```

`apps/api/src/test/resources/application-test.yml` 끝에 추가한다. 테스트 전용 고정값이라 소스에 있어도 안전하다.

```yaml
app:
  jwt:
    secret: test-secret-key-for-hs256-at-least-32-bytes
    ttl: PT1H
```

- [ ] **Step 8: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. `SecurityConfigTest` 3건 + 기존 `ApiApplicationTests`·`HealthEndpointTest` 2건 = 5건 통과.

`/me` 는 아직 없지만 Spring Security 가 인증을 먼저 검사하므로 404 가 아니라 **401** 이 나온다. 이게 이 테스트의 요지다.

- [ ] **Step 9: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git branch --show-current   # dev 확인
git add apps/api
git commit -m "feat(api): Spring Security JWT 리소스 서버 구성 — HS256 대칭키·역할 authority 매핑"
```

---

## Task 2: meta_connections 엔티티 + AES-GCM 컬럼 암호화

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/connection/EncryptedStringConverter.java`
- Create: `apps/api/src/main/java/ai/adflow/api/connection/MetaConnection.java`
- Create: `apps/api/src/main/java/ai/adflow/api/connection/MetaConnectionRepository.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Modify: `apps/api/src/test/resources/application-test.yml`
- Test: `apps/api/src/test/java/ai/adflow/api/connection/MetaConnectionRepositoryTest.java`

**Interfaces:**
- Consumes: Task 1 의 `application.yml` `app:` 블록 구조
- Produces:
  - 엔티티 `MetaConnection` — 필드 `String ownerKey`(PK), `String email`, `Role role`, `String accessToken`, `String adAccountId`, `String adAccountName`, `String pageId`, `String pageName`, `String pixelId`, `String pixelName`, `String igUserId`, `String igUsername`, `String igAccessToken`, `Instant updatedAt`. 기본 생성자 + 전 필드 getter/setter.
  - `MetaConnectionRepository extends JpaRepository<MetaConnection, String>`
  - 토큰 컬럼(`accessToken`·`igAccessToken`)은 `EncryptedStringConverter` 로 자동 암복호화된다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

핵심 검증은 두 가지다 — 라운드트립이 되는가, 그리고 **DB 에 실제로 저장된 값이 평문이 아닌가.** 후자를 확인하지 않으면 암호화가 동작하는지 알 수 없다.

`apps/api/src/test/java/ai/adflow/api/connection/MetaConnectionRepositoryTest.java`:

```java
package ai.adflow.api.connection;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.security.Role;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MetaConnectionRepositoryTest {

  private static final String PLAIN_TOKEN = "EAAG-super-secret-meta-token";

  @Autowired private MetaConnectionRepository repository;
  @Autowired private JdbcTemplate jdbcTemplate;

  private MetaConnection sample() {
    MetaConnection c = new MetaConnection();
    c.setOwnerKey("owner@example.com");
    c.setEmail("owner@example.com");
    c.setRole(Role.LEAD);
    c.setAccessToken(PLAIN_TOKEN);
    c.setAdAccountId("act_123");
    c.setUpdatedAt(Instant.now());
    return c;
  }

  @Test
  void 저장하고_읽으면_토큰이_복호화된다() {
    repository.saveAndFlush(sample());
    MetaConnection found = repository.findById("owner@example.com").orElseThrow();
    assertThat(found.getAccessToken()).isEqualTo(PLAIN_TOKEN);
    assertThat(found.getAdAccountId()).isEqualTo("act_123");
    assertThat(found.getRole()).isEqualTo(Role.LEAD);
  }

  @Test
  void DB에_저장된_토큰은_평문이_아니다() {
    repository.saveAndFlush(sample());
    String stored =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?",
            String.class,
            "owner@example.com");
    assertThat(stored).isNotNull();
    assertThat(stored).isNotEqualTo(PLAIN_TOKEN);
    assertThat(stored).doesNotContain("EAAG");
  }

  @Test
  void 같은_평문을_두번_암호화하면_다른_값이_나온다() {
    MetaConnection first = sample();
    first.setOwnerKey("a@example.com");
    repository.saveAndFlush(first);

    MetaConnection second = sample();
    second.setOwnerKey("b@example.com");
    repository.saveAndFlush(second);

    String storedA =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?", String.class, "a@example.com");
    String storedB =
        jdbcTemplate.queryForObject(
            "select access_token from meta_connections where owner_key = ?", String.class, "b@example.com");

    // IV 가 매번 달라야 한다. 같으면 같은 평문이 같은 암호문이 되어 패턴이 드러난다.
    assertThat(storedA).isNotEqualTo(storedB);
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `MetaConnection`·`MetaConnectionRepository` 가 없어 컴파일 에러.

- [ ] **Step 3: 암호화 컨버터 작성**

`apps/api/src/main/java/ai/adflow/api/connection/EncryptedStringConverter.java`:

```java
package ai.adflow.api.connection;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-GCM 컬럼 암호화. 저장 형식은 Base64(IV ‖ ciphertext ‖ tag).
 *
 * IV 는 매 저장마다 새로 뽑는다 — 고정하면 같은 평문이 같은 암호문이 되어 패턴이 드러난다.
 * GCM 은 인증 태그를 포함하므로 저장값이 변조되면 복호화 단계에서 예외가 난다.
 */
@Component
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;
  private static final SecureRandom RNG = new SecureRandom();

  private final SecretKeySpec key;

  // 생성자 주입만 쓴다. Spring Boot 이 Hibernate 의 bean container 를 SpringBeanContainer 로
  // 등록하므로 Hibernate 가 이 컨버터를 스프링 빈으로 받아간다. 정적 필드 공유 같은 우회가 필요 없다.
  // 만약 이 가정이 깨지면 Task 2 Step 7 에서 컨텍스트 로딩이 즉시 실패해 바로 드러난다.
  public EncryptedStringConverter(@Value("${app.encryption.key}") String configured) {
    byte[] raw = configured.getBytes(StandardCharsets.UTF_8);
    if (raw.length != 32) {
      throw new IllegalStateException(
          "app.encryption.key 는 정확히 32바이트여야 해요 (AES-256). 현재 " + raw.length + "바이트.");
    }
    this.key = new SecretKeySpec(raw, "AES");
  }

  @Override
  public String convertToDatabaseColumn(String plain) {
    if (plain == null) return null;
    try {
      byte[] iv = new byte[IV_BYTES];
      RNG.nextBytes(iv);
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));

      byte[] packed = new byte[iv.length + ciphertext.length];
      System.arraycopy(iv, 0, packed, 0, iv.length);
      System.arraycopy(ciphertext, 0, packed, iv.length, ciphertext.length);
      return Base64.getEncoder().encodeToString(packed);
    } catch (Exception e) {
      throw new IllegalStateException("토큰 암호화에 실패했어요.", e);
    }
  }

  @Override
  public String convertToEntityAttribute(String stored) {
    if (stored == null) return null;
    try {
      byte[] packed = Base64.getDecoder().decode(stored);
      byte[] iv = new byte[IV_BYTES];
      System.arraycopy(packed, 0, iv, 0, IV_BYTES);
      byte[] ciphertext = new byte[packed.length - IV_BYTES];
      System.arraycopy(packed, IV_BYTES, ciphertext, 0, ciphertext.length);

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("토큰 복호화에 실패했어요. 암호화 키가 바뀌었거나 값이 손상됐어요.", e);
    }
  }
}
```

- [ ] **Step 4: 엔티티 작성**

`apps/api/src/main/java/ai/adflow/api/connection/MetaConnection.java`:

```java
package ai.adflow.api.connection;

import ai.adflow.api.security.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Owner Key(= NextAuth 로그인 email) 당 Meta 연결 1건.
 *
 * 액세스 토큰 2종은 컬럼 암호화한다 — 60일 장기 토큰이 평문으로 DB 에 앉아 있으면 안 된다.
 */
@Entity
@Table(name = "meta_connections")
public class MetaConnection {

  @Id
  @Column(name = "owner_key")
  private String ownerKey;

  private String email;

  @Enumerated(EnumType.STRING)
  private Role role;

  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "access_token", length = 2048)
  private String accessToken;

  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "ig_access_token", length = 2048)
  private String igAccessToken;

  @Column(name = "ad_account_id") private String adAccountId;
  @Column(name = "ad_account_name") private String adAccountName;
  @Column(name = "page_id") private String pageId;
  @Column(name = "page_name") private String pageName;
  @Column(name = "pixel_id") private String pixelId;
  @Column(name = "pixel_name") private String pixelName;
  @Column(name = "ig_user_id") private String igUserId;
  @Column(name = "ig_username") private String igUsername;

  @Column(name = "updated_at") private Instant updatedAt;

  public String getOwnerKey() { return ownerKey; }
  public void setOwnerKey(String v) { this.ownerKey = v; }
  public String getEmail() { return email; }
  public void setEmail(String v) { this.email = v; }
  public Role getRole() { return role; }
  public void setRole(Role v) { this.role = v; }
  public String getAccessToken() { return accessToken; }
  public void setAccessToken(String v) { this.accessToken = v; }
  public String getIgAccessToken() { return igAccessToken; }
  public void setIgAccessToken(String v) { this.igAccessToken = v; }
  public String getAdAccountId() { return adAccountId; }
  public void setAdAccountId(String v) { this.adAccountId = v; }
  public String getAdAccountName() { return adAccountName; }
  public void setAdAccountName(String v) { this.adAccountName = v; }
  public String getPageId() { return pageId; }
  public void setPageId(String v) { this.pageId = v; }
  public String getPageName() { return pageName; }
  public void setPageName(String v) { this.pageName = v; }
  public String getPixelId() { return pixelId; }
  public void setPixelId(String v) { this.pixelId = v; }
  public String getPixelName() { return pixelName; }
  public void setPixelName(String v) { this.pixelName = v; }
  public String getIgUserId() { return igUserId; }
  public void setIgUserId(String v) { this.igUserId = v; }
  public String getIgUsername() { return igUsername; }
  public void setIgUsername(String v) { this.igUsername = v; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant v) { this.updatedAt = v; }
}
```

- [ ] **Step 5: 리포지토리 작성**

`apps/api/src/main/java/ai/adflow/api/connection/MetaConnectionRepository.java`:

```java
package ai.adflow.api.connection;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MetaConnectionRepository extends JpaRepository<MetaConnection, String> {}
```

- [ ] **Step 6: 암호화 키 설정 추가**

`apps/api/src/main/resources/application.yml` 의 `app:` 블록에 `encryption` 을 추가한다.

```yaml
app:
  jwt:
    secret: ${ADFLOW_JWT_SECRET:}
    ttl: PT1H
  encryption:
    # AES-256 컬럼 암호화 키. 정확히 32바이트. 실값은 환경변수로만.
    # 이 키를 잃으면 저장된 Meta 토큰을 복구할 수 없다 — 재로그인으로 다시 받아야 한다.
    key: ${ADFLOW_ENCRYPTION_KEY:}
  poller:
    interval: PT6H
```

`apps/api/src/test/resources/application-test.yml` 의 `app:` 블록에 추가한다.

```yaml
app:
  jwt:
    secret: test-secret-key-for-hs256-at-least-32-bytes
    ttl: PT1H
  encryption:
    key: test-encryption-key-32-bytes-ok!
```

`test-encryption-key-32-bytes-ok!` 는 정확히 32바이트다. 길이를 바꾸면 컨텍스트 로딩이 실패한다.

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. `MetaConnectionRepositoryTest` 3건 포함 총 8건.

`DB에_저장된_토큰은_평문이_아니다` 가 실패하면 컨버터가 배선되지 않은 것이다. `@Convert(converter = ...)` 가 필드에 붙어 있는지 확인하라.

- [ ] **Step 8: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): meta_connections 엔티티 · AES-GCM 컬럼 암호화 — 토큰 평문 저장 제거"
```

---

## Task 3: `/auth/exchange` 토큰 교환 엔드포인트

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/auth/ExchangeRequest.java`
- Create: `apps/api/src/main/java/ai/adflow/api/auth/ExchangeResponse.java`
- Create: `apps/api/src/main/java/ai/adflow/api/security/TokenIssuer.java`
- Create: `apps/api/src/main/java/ai/adflow/api/auth/AuthExchangeController.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Modify: `apps/api/src/test/resources/application-test.yml`
- Test: `apps/api/src/test/java/ai/adflow/api/auth/AuthExchangeControllerTest.java`

**Interfaces:**
- Consumes: Task 1 의 `JwtEncoder`·`Role`·`JwtConfig.ROLES_CLAIM`, Task 2 의 `MetaConnection`·`MetaConnectionRepository`
- Produces:
  - `POST /auth/exchange` — 헤더 `X-Internal-Secret`, 본문 `ExchangeRequest`, 응답 `ExchangeResponse { String token; Instant expiresAt; }`
  - `TokenIssuer.issue(String ownerKey, String email, Role role)` → `TokenIssuer.Issued`(record: `String token`, `Instant expiresAt`)
  - 게스트 sentinel `guest@adflow.local` 은 400 으로 거부한다.

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/auth/AuthExchangeControllerTest.java`:

```java
package ai.adflow.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.connection.MetaConnectionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthExchangeControllerTest {

  private static final String SECRET_HEADER = "X-Internal-Secret";
  private static final String SECRET = "test-internal-secret";

  private static final String BODY =
      """
      {
        "ownerKey": "owner@example.com",
        "email": "owner@example.com",
        "role": "팀장",
        "metaConnection": {
          "accessToken": "EAAG-token",
          "adAccountId": "act_123",
          "igUsername": "greenroutine_official"
        }
      }
      """;

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtDecoder jwtDecoder;
  @Autowired private MetaConnectionRepository repository;

  @Test
  void 내부_시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(post("/auth/exchange").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 내부_시크릿이_틀리면_401() throws Exception {
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, "wrong")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 게스트는_거부한다() throws Exception {
    String guestBody = BODY.replace("owner@example.com", "guest@adflow.local");
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(guestBody))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 정상_교환이면_JWT와_역할클레임을_준다() throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/auth/exchange")
                    .header(SECRET_HEADER, SECRET)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(BODY))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").isNotEmpty())
            .andExpect(jsonPath("$.expiresAt").isNotEmpty())
            .andReturn();

    String token =
        com.fasterxml.jackson.databind.json.JsonMapper.builder()
            .build()
            .readTree(result.getResponse().getContentAsString())
            .get("token")
            .asText();

    var jwt = jwtDecoder.decode(token);
    assertThat(jwt.getSubject()).isEqualTo("owner@example.com");
    assertThat(jwt.getClaimAsStringList("roles")).containsExactly("LEAD");
  }

  @Test
  void 교환하면_Meta연결이_저장된다() throws Exception {
    mockMvc
        .perform(
            post("/auth/exchange")
                .header(SECRET_HEADER, SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY))
        .andExpect(status().isOk());

    var saved = repository.findById("owner@example.com").orElseThrow();
    assertThat(saved.getAccessToken()).isEqualTo("EAAG-token");
    assertThat(saved.getAdAccountId()).isEqualTo("act_123");
    assertThat(saved.getIgUsername()).isEqualTo("greenroutine_official");
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `AuthExchangeController` 가 없어 `/auth/exchange` 가 404 이거나 컴파일 에러.

- [ ] **Step 3: 요청·응답 DTO 작성**

`apps/api/src/main/java/ai/adflow/api/auth/ExchangeRequest.java`:

```java
package ai.adflow.api.auth;

import jakarta.validation.constraints.NotBlank;

/** Next.js 서버가 로그인 직후 보내는 신원 + Meta 연결 묶음. */
public record ExchangeRequest(
    @NotBlank String ownerKey,
    @NotBlank String email,
    String role,
    MetaConnectionPayload metaConnection) {

  public record MetaConnectionPayload(
      String accessToken,
      String igAccessToken,
      String adAccountId,
      String adAccountName,
      String pageId,
      String pageName,
      String pixelId,
      String pixelName,
      String igUserId,
      String igUsername) {}
}
```

`apps/api/src/main/java/ai/adflow/api/auth/ExchangeResponse.java`:

```java
package ai.adflow.api.auth;

import java.time.Instant;

public record ExchangeResponse(String token, Instant expiresAt) {}
```

- [ ] **Step 4: TokenIssuer 작성**

`apps/api/src/main/java/ai/adflow/api/security/TokenIssuer.java`:

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

  public TokenIssuer(JwtEncoder encoder, @Value("${app.jwt.ttl}") Duration ttl) {
    this.encoder = encoder;
    this.ttl = ttl;
  }

  public Issued issue(String ownerKey, String email, Role role) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(ttl);

    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("adflow-api")
            .subject(ownerKey)
            .issuedAt(now)
            .expiresAt(expiresAt)
            .claim("email", email)
            .claim(JwtConfig.ROLES_CLAIM, List.of(role.authority()))
            .build();

    String token =
        encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
            .getTokenValue();

    return new Issued(token, expiresAt);
  }

  public record Issued(String token, Instant expiresAt) {}
}
```

- [ ] **Step 5: 컨트롤러 작성**

`apps/api/src/main/java/ai/adflow/api/auth/AuthExchangeController.java`:

```java
package ai.adflow.api.auth;

import ai.adflow.api.connection.MetaConnection;
import ai.adflow.api.connection.MetaConnectionRepository;
import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로그인은 NextAuth 가 한다(Meta OAuth 토큰이 거기서만 나온다). 이 엔드포인트는 그 결과를 받아
 * Meta 연결을 영속하고 우리 JWT 를 발급한다.
 *
 * JWT 가 없는 상태에서 호출되므로 리소스 서버 인증 대신 내부 시크릿으로 지킨다.
 */
@RestController
@RequestMapping("/auth")
public class AuthExchangeController {

  /** 영속 제외 sentinel — 둘러보기 게스트는 백엔드를 쓰지 않는다 (ADR-033). */
  private static final String GUEST_OWNER = "guest@adflow.local";

  private final MetaConnectionRepository repository;
  private final TokenIssuer tokenIssuer;
  private final byte[] internalSecret;

  public AuthExchangeController(
      MetaConnectionRepository repository,
      TokenIssuer tokenIssuer,
      @Value("${app.internal-secret}") String internalSecret) {
    this.repository = repository;
    this.tokenIssuer = tokenIssuer;
    this.internalSecret = internalSecret.getBytes(StandardCharsets.UTF_8);
  }

  @PostMapping("/exchange")
  public ResponseEntity<ExchangeResponse> exchange(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @Valid @RequestBody ExchangeRequest request) {

    requireInternalSecret(presented);

    if (GUEST_OWNER.equals(request.ownerKey()) || GUEST_OWNER.equals(request.email())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "둘러보기 게스트는 토큰을 발급받지 않아요.");
    }

    Role role = request.role() == null ? Role.LEAD : Role.fromDisplayName(request.role());
    persist(request, role);

    TokenIssuer.Issued issued = tokenIssuer.issue(request.ownerKey(), request.email(), role);
    return ResponseEntity.ok(new ExchangeResponse(issued.token(), issued.expiresAt()));
  }

  /** 타이밍 공격을 피하려고 상수시간 비교를 쓴다. */
  private void requireInternalSecret(String presented) {
    if (presented == null
        || !MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), internalSecret)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "내부 호출 자격이 없어요.");
    }
  }

  private void persist(ExchangeRequest request, Role role) {
    MetaConnection entity =
        repository.findById(request.ownerKey()).orElseGet(MetaConnection::new);
    entity.setOwnerKey(request.ownerKey());
    entity.setEmail(request.email());
    entity.setRole(role);
    entity.setUpdatedAt(Instant.now());

    ExchangeRequest.MetaConnectionPayload meta = request.metaConnection();
    if (meta != null) {
      entity.setAccessToken(meta.accessToken());
      entity.setIgAccessToken(meta.igAccessToken());
      entity.setAdAccountId(meta.adAccountId());
      entity.setAdAccountName(meta.adAccountName());
      entity.setPageId(meta.pageId());
      entity.setPageName(meta.pageName());
      entity.setPixelId(meta.pixelId());
      entity.setPixelName(meta.pixelName());
      entity.setIgUserId(meta.igUserId());
      entity.setIgUsername(meta.igUsername());
    }
    repository.save(entity);
  }
}
```

- [ ] **Step 6: 내부 시크릿 설정 추가**

`apps/api/src/main/resources/application.yml` 의 `app:` 블록에 한 줄을 더한다.

```yaml
app:
  # Next.js 서버만 아는 값. /auth/exchange 호출자를 식별한다.
  internal-secret: ${ADFLOW_INTERNAL_SECRET:}
  jwt:
    secret: ${ADFLOW_JWT_SECRET:}
    ttl: PT1H
  encryption:
    key: ${ADFLOW_ENCRYPTION_KEY:}
  poller:
    interval: PT6H
```

`apps/api/src/test/resources/application-test.yml` 의 `app:` 블록에도 더한다.

```yaml
app:
  internal-secret: test-internal-secret
  jwt:
    secret: test-secret-key-for-hs256-at-least-32-bytes
    ttl: PT1H
  encryption:
    key: test-encryption-key-32-bytes-ok!
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. `AuthExchangeControllerTest` 5건 포함 총 13건.

- [ ] **Step 8: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /auth/exchange 토큰 교환 — 내부 시크릿 검증·Meta 연결 영속·JWT 발급"
```

---

## Task 4: 역할 기반 인가 (`@PreAuthorize`)

지금 `role` 은 세션에만 있고 **어디서도 강제되지 않는다.** 이 Task 가 처음으로 서버에서 막는다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/me/MeController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/me/MeControllerTest.java`

**Interfaces:**
- Consumes: Task 1 의 `JwtAuthenticationConverter`(roles → `ROLE_*`), Task 2 의 `MetaConnectionRepository`
- Produces:
  - `GET /me` — 인증된 누구나. 응답 `{ ownerKey, email, role }` (role 은 한글 표시명)
  - `DELETE /me/meta-connection` — **팀장(LEAD)만**. 성공 204, 권한 없으면 403

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`spring-security-test` 의 `SecurityMockMvcRequestPostProcessors.jwt()` 로 토큰을 흉내낸다. 실제 서명 없이 authority 를 주입할 수 있어 인가 로직만 좁게 검증된다.

`apps/api/src/test/java/ai/adflow/api/me/MeControllerTest.java`:

```java
package ai.adflow.api.me;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeControllerTest {

  @Autowired private MockMvc mockMvc;

  @Test
  void 인증되면_내_정보를_준다() throws Exception {
    mockMvc
        .perform(
            get("/me")
                .with(
                    jwt()
                        .jwt(
                            j ->
                                j.subject("owner@example.com")
                                    .claim("email", "owner@example.com")
                                    .claim("roles", java.util.List.of("MEMBER_REVIEW")))
                        .authorities(new SimpleGrantedAuthority("ROLE_MEMBER_REVIEW"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerKey").value("owner@example.com"))
        .andExpect(jsonPath("$.role").value("팀원·검토"));
  }

  @Test
  void 팀장은_연결을_삭제할_수_있다() throws Exception {
    mockMvc
        .perform(
            delete("/me/meta-connection")
                .with(
                    jwt()
                        .jwt(j -> j.subject("owner@example.com"))
                        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"))))
        .andExpect(status().isNoContent());
  }

  @Test
  void 팀원은_연결을_삭제할_수_없다() throws Exception {
    mockMvc
        .perform(
            delete("/me/meta-connection")
                .with(
                    jwt()
                        .jwt(j -> j.subject("owner@example.com"))
                        .authorities(new SimpleGrantedAuthority("ROLE_MEMBER_PUBLISH"))))
        .andExpect(status().isForbidden());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: FAIL — `MeController` 가 없어 `/me` 가 404.

- [ ] **Step 3: 컨트롤러 작성**

`apps/api/src/main/java/ai/adflow/api/me/MeController.java`:

```java
package ai.adflow.api.me;

import ai.adflow.api.connection.MetaConnectionRepository;
import ai.adflow.api.security.Role;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/me")
public class MeController {

  private final MetaConnectionRepository repository;

  public MeController(MetaConnectionRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
    String authority =
        jwt.getClaimAsStringList("roles") == null || jwt.getClaimAsStringList("roles").isEmpty()
            ? Role.LEAD.authority()
            : jwt.getClaimAsStringList("roles").get(0);
    return Map.of(
        "ownerKey", jwt.getSubject(),
        "email", jwt.getClaimAsString("email") == null ? "" : jwt.getClaimAsString("email"),
        "role", Role.fromAuthority(authority).displayName());
  }

  /** 자격증명 교체·삭제는 팀장만 (설계 §4 인가). */
  @DeleteMapping("/meta-connection")
  @PreAuthorize("hasRole('LEAD')")
  public ResponseEntity<Void> deleteConnection(@AuthenticationPrincipal Jwt jwt) {
    repository.deleteById(jwt.getSubject());
    return ResponseEntity.noContent().build();
  }
}
```

`GET /me` 는 authority 가 아니라 `roles` 클레임을 읽는다. Step 1 의 테스트가 클레임과 authority 를 둘 다 준 이유다 — 실제 발급 토큰(Task 3 `TokenIssuer`)에도 둘이 함께 들어간다. 클레임이 비는 경우는 방어적으로 `LEAD` 로 떨어뜨린다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. `MeControllerTest` 3건 포함 총 16건.

`팀원은_연결을_삭제할_수_없다` 가 403 이 아니라 200 이면 `@EnableMethodSecurity` 가 빠진 것이다 (Task 1 `SecurityConfig`).

- [ ] **Step 5: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): role 기반 인가 — GET /me · DELETE /me/meta-connection 은 팀장 전용"
```

---

## Task 5: Next.js 교환 배선

**Files:**
- Create: `apps/web/src/shared/lib/backend/client.ts`
- Create: `apps/web/src/shared/lib/backend/exchange.ts`
- Create: `apps/web/src/shared/lib/backend/exchange.test.ts`
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/types/next-auth.d.ts`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: Task 3 의 `POST /auth/exchange` 계약
- Produces:
  - `backendBaseUrl(): string | null` — `ADFLOW_BACKEND_URL` 미설정이면 null (휴면)
  - `exchangeForBackendToken(input: ExchangeInput): Promise<BackendToken | null>` — 게스트·미설정이면 호출하지 않고 null
  - 세션 JWT 필드 `backendToken?: string`, `backendTokenExpiresAt?: string`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

핵심은 **게스트가 백엔드를 호출하지 않는 것**이다. 둘러보기 모드의 설계 제약이 코드로 지켜지는지 본다.

`apps/web/src/shared/lib/backend/exchange.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeForBackendToken } from "./exchange";

const ORIGINAL_URL = process.env.ADFLOW_BACKEND_URL;
const ORIGINAL_SECRET = process.env.ADFLOW_INTERNAL_SECRET;

function realUser() {
  return {
    ownerKey: "owner@example.com",
    email: "owner@example.com",
    role: "팀장" as const,
    metaConnection: { accessToken: "EAAG-token" },
  };
}

describe("exchangeForBackendToken", () => {
  beforeEach(() => {
    process.env.ADFLOW_BACKEND_URL = "http://localhost:8080";
    process.env.ADFLOW_INTERNAL_SECRET = "test-internal-secret";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.ADFLOW_BACKEND_URL;
    else process.env.ADFLOW_BACKEND_URL = ORIGINAL_URL;
    if (ORIGINAL_SECRET === undefined) delete process.env.ADFLOW_INTERNAL_SECRET;
    else process.env.ADFLOW_INTERNAL_SECRET = ORIGINAL_SECRET;
  });

  it("게스트면 백엔드를 호출하지 않아요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await exchangeForBackendToken({
      ...realUser(),
      ownerKey: "guest@adflow.local",
      email: "guest@adflow.local",
    });
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("백엔드 URL 이 없으면 호출하지 않아요", async () => {
    delete process.env.ADFLOW_BACKEND_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await exchangeForBackendToken(realUser());
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("정상이면 토큰을 돌려주고 내부 시크릿을 헤더에 실어요", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ token: "jwt-abc", expiresAt: "2026-07-26T12:00:00Z" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeForBackendToken(realUser());

    expect(result).toEqual({ token: "jwt-abc", expiresAt: "2026-07-26T12:00:00Z" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8080/auth/exchange");
    expect((init?.headers as Record<string, string>)["X-Internal-Secret"]).toBe(
      "test-internal-secret",
    );
  });

  it("백엔드가 실패해도 예외를 던지지 않고 null 을 줘요", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const result = await exchangeForBackendToken(realUser());
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/backend/exchange.test.ts
```

기대: FAIL — `./exchange` 모듈이 없어 import 에러.

- [ ] **Step 3: 백엔드 클라이언트 작성**

`apps/web/src/shared/lib/backend/client.ts`:

```ts
// Spring 백엔드 호출의 단일 통로. server-side only — 내부 시크릿을 다룬다.
//
// 미설정이면 null 을 반환해 호출부가 조용히 건너뛴다. Supabase 클라이언트가 키 없을 때
// null 을 주던 것과 같은 계약이다. 배포 환경(백엔드 미배포)이 이 경로로 자동 휴면한다.

export function backendBaseUrl(): string | null {
  const raw = process.env.ADFLOW_BACKEND_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function internalSecret(): string | null {
  return process.env.ADFLOW_INTERNAL_SECRET ?? null;
}
```

- [ ] **Step 4: 교환 모듈 작성**

`apps/web/src/shared/lib/backend/exchange.ts`:

```ts
import { GUEST_OWNER, isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl, internalSecret } from "./client";

export type ExchangeInput = {
  ownerKey: string;
  email: string;
  role?: string;
  metaConnection?: Record<string, string | undefined>;
};

export type BackendToken = {
  token: string;
  expiresAt: string;
};

// 로그인 직후 1회. 실패해도 로그인을 깨지 않는다 — 단계 1 시점에 프론트 데이터는
// 여전히 Supabase 라 백엔드 토큰이 없어도 앱은 정상 동작한다.
export async function exchangeForBackendToken(
  input: ExchangeInput,
): Promise<BackendToken | null> {
  if (!isRealOwner(input.ownerKey) || input.email === GUEST_OWNER) return null;

  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) return null;

  try {
    const res = await fetch(`${base}/auth/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.error("[backend] 토큰 교환 실패", res.status);
      return null;
    }
    return (await res.json()) as BackendToken;
  } catch (e) {
    console.error("[backend] 토큰 교환 중 오류", e);
    return null;
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web
npx vitest run src/shared/lib/backend/exchange.test.ts
```

기대: PASS, 4건.

- [ ] **Step 6: 세션 타입에 필드 추가**

`apps/web/types/next-auth.d.ts` 의 `JWT` 인터페이스에 두 줄을 넣는다. `Session` 에는 **넣지 않는다** — 브라우저로 내려가면 안 되는 값이다.

```ts
declare module "next-auth/jwt" {
  interface JWT {
    // Spring 백엔드 토큰. 서버 전용 — Session 에 노출하지 않는다(설계 §4).
    backendToken?: string
    backendTokenExpiresAt?: string
    accessToken?: string
```

- [ ] **Step 7: 로그인 직후 교환을 호출한다**

`apps/web/lib/auth.ts` 의 `callbacks.jwt` 에서 Facebook 토큰 교환 블록(`if (account?.access_token && meta) { ... }`) 바로 다음에 넣는다. `token.role` 이 그 블록에서 정해지므로 순서가 중요하다.

먼저 파일 상단 import 에 한 줄을 더한다.

```ts
import { exchangeForBackendToken } from "@shared/lib/backend/exchange"
```

그리고 `if (account?.access_token && meta) { ... }` 블록 아래에 이어 붙인다.

```ts
        // 로그인 직후 Spring 백엔드와 1회 교환. 게스트·백엔드 미설정이면 내부에서 건너뛴다.
        // 실패해도 로그인을 깨지 않는다 — 단계 1 에서 프론트 데이터는 여전히 Supabase.
        if (account && token.email) {
          const issued = await exchangeForBackendToken({
            ownerKey: token.email,
            email: token.email,
            role: token.role,
            metaConnection: {
              accessToken: token.accessToken,
              igAccessToken: token.igAccessToken,
              adAccountId: token.adAccountId,
              adAccountName: token.adAccountName,
              pageId: token.pageId,
              pageName: token.pageName,
              pixelId: token.pixelId,
              pixelName: token.pixelName,
              igUserId: token.igUserId,
              igUsername: token.igUsername,
            },
          })
          if (issued) {
            token.backendToken = issued.token
            token.backendTokenExpiresAt = issued.expiresAt
          }
        }
```

- [ ] **Step 8: 환경변수 문서화**

`apps/web/.env.example` 의 `ADFLOW_BROWSE_ONLY` 블록 바로 위에 넣는다.

```
## Spring 백엔드 (단계 1~) — 미설정이면 백엔드 호출이 전부 휴면해요.
## 로컬은 http://localhost:8080. 배포 환경에는 넣지 않아요(둘러보기 전용이니까요).
# ADFLOW_BACKEND_URL=http://localhost:8080
## Next.js 서버만 아는 값. apps/api 의 ADFLOW_INTERNAL_SECRET 과 같아야 해요.
# ADFLOW_INTERNAL_SECRET=

```

- [ ] **Step 9: 전체 회귀 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
npm run build
```

기대: tsc 에러 0 · `Test Files 65 passed` / `Tests 680 passed` (기존 676 + 신규 4) · build 성공

- [ ] **Step 10: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git branch --show-current
git add apps/web
git commit -m "feat(auth): 로그인 직후 Spring 토큰 교환 배선 — 게스트·미설정은 휴면"
```

---

## Task 6: 로컬 통합 확인

여기까지는 각 조각의 단위 검증이다. 이 Task 는 **실제로 두 프로세스를 붙여** 동작을 확인한다.

**Files:** 없음 (검증 전용). 문제가 나오면 해당 Task 로 돌아간다.

**Interfaces:**
- Consumes: Task 1~5 전부

- [ ] **Step 1: 시크릿 3개를 로컬에 준비**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
python3 -c "import secrets;print('ADFLOW_JWT_SECRET=' + secrets.token_urlsafe(48))"
python3 -c "import secrets;print('ADFLOW_INTERNAL_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets,base64;print('ADFLOW_ENCRYPTION_KEY=' + base64.urlsafe_b64encode(secrets.token_bytes(24)).decode()[:32])"
```

`ADFLOW_ENCRYPTION_KEY` 는 **정확히 32자** 여야 한다. 출력값의 길이를 `echo -n "<값>" | wc -c` 로 확인하라.

출력 3줄을 `apps/web/.env.local` 에 붙이고, `ADFLOW_BACKEND_URL=http://localhost:8080` 도 더한다. Spring 쪽은 같은 값을 셸 환경변수로 넘긴다.

- [ ] **Step 2: Postgres 와 Spring 을 띄운다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose up -d postgres
cd apps/api
ADFLOW_JWT_SECRET='<위에서 만든 값>' \
ADFLOW_INTERNAL_SECRET='<위에서 만든 값>' \
ADFLOW_ENCRYPTION_KEY='<위에서 만든 32자>' \
./gradlew bootRun --args='--spring.profiles.active=local'
```

기대: `Started ApiApplication`. `ddl-auto: update` 가 `meta_connections` 테이블을 만든다.

- [ ] **Step 3: 테이블이 실제로 생겼는지 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
docker compose exec -T postgres psql -U adflow -d adflow -c "\d meta_connections"
```

기대: `owner_key` PK, `access_token`·`ig_access_token` 을 포함한 컬럼 목록.

- [ ] **Step 4: 교환을 직접 호출한다**

```bash
curl -sS -X POST http://localhost:8080/auth/exchange \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: <내부 시크릿>" \
  -d '{"ownerKey":"me@example.com","email":"me@example.com","role":"팀장","metaConnection":{"accessToken":"EAAG-real-looking-token","adAccountId":"act_999"}}'
```

기대: `{"token":"eyJ...","expiresAt":"..."}`

- [ ] **Step 5: DB 에 평문이 없는지 눈으로 확인한다**

이 단계가 암호화의 최종 증거다.

```bash
docker compose exec -T postgres psql -U adflow -d adflow \
  -c "select owner_key, left(access_token, 40) as stored_prefix from meta_connections;"
```

기대: `stored_prefix` 가 Base64 문자열이고 `EAAG` 로 시작하지 않는다.

- [ ] **Step 6: 발급받은 토큰으로 보호 경로를 호출한다**

```bash
TOKEN='<Step 4 에서 받은 token>'
echo "--- 토큰 없이 ---"
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/me
echo "--- 토큰으로 ---"
curl -sS -H "Authorization: Bearer $TOKEN" http://localhost:8080/me
echo "--- 팀장 전용 삭제 ---"
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE \
  -H "Authorization: Bearer $TOKEN" http://localhost:8080/me/meta-connection
```

기대: `401` → `{"ownerKey":"me@example.com","email":"me@example.com","role":"팀장"}` → `204`

- [ ] **Step 7: 게스트가 백엔드를 호출하지 않는지 확인한다**

`npm run dev` 로 앱을 띄우고 `/login` 에서 **둘러보기**로 들어간다. Spring 로그에 `/auth/exchange` 요청이 **한 건도 남지 않아야 한다.**

```bash
grep -c "auth/exchange" /tmp/spring-bootrun.log
```

기대: `0`

- [ ] **Step 8: OpenAPI 계약을 재생성한다**

새 엔드포인트 3개가 스펙에 반영되는지 본다.

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npm run contracts:generate
grep -oE '"/(auth/exchange|me|me/meta-connection)"' packages/contracts/openapi.json | sort -u
```

기대: 3개 경로가 모두 출력된다. `packages/contracts/types/api.d.ts` 의 `paths` 도 더 이상 비어 있지 않다.

- [ ] **Step 9: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add packages/contracts
git commit -m "chore(contracts): 단계 1 엔드포인트 반영 — auth/exchange · me"
```

---

## 완료 조건

- [ ] `cd apps/api && ./gradlew test` green (16건), **Docker 없이도 통과**
- [ ] `npm test` → 65 files / 680 tests green
- [ ] `npm run build` 성공 · `tsc` 에러 0
- [ ] `meta_connections` 테이블이 Postgres 에 생성됨
- [ ] DB 의 `access_token` 이 평문이 아님 (Base64, `EAAG` 미포함)
- [ ] `POST /auth/exchange` — 시크릿 없으면 401, 게스트면 400, 정상이면 JWT
- [ ] `GET /me` — 토큰 없으면 401, 있으면 한글 역할명 반환
- [ ] `DELETE /me/meta-connection` — 팀장 204, 팀원 403
- [ ] 둘러보기 모드에서 `/auth/exchange` 호출 0건
- [ ] `packages/contracts/openapi.json` 에 신규 경로 3개 반영
- [ ] 커밋 6개, Task 단위

## 이 단계에서 하지 않는 것

- 프론트의 Supabase 호출 교체 (단계 2)
- Synced Store 정규화·엔티티 확장 (단계 2)
- Testcontainers 도입 — 단계 1 의 엔티티는 테이블 1개에 Postgres 고유 SQL 이 없어 H2 로 충분하다. 정규화된 스키마와 실제 쿼리가 들어오는 **단계 2 에서 도입**한다 (설계 §8).
- 토큰 만료 시 자동 재교환 — 단계 2 에서 백엔드를 실제로 호출하기 시작할 때 그 호출 경로에 붙인다. 지금은 발급까지만.
- `role` 을 실제 사용자별로 다르게 주는 흐름 — 현재 모든 로그인이 `팀장` 으로 떨어진다(기존 동작). 역할 관리 UI 는 별도 과제다.
