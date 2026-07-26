# 단계 4 — 나머지 테이블 6개 + 스토리지 버킷 2개 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `products`·`reference_materials`·`onboarded_users`·`cron_runs`·`ig_messages` 5개 테이블과 스토리지 버킷 2개(`product-images`·`reference-materials`)를 Spring 이 인수한다. 끝나면 **Supabase 에 남는 것은 `tournaments` 와 `notion_connections` 둘뿐이다.**

> **범위 조정 (사용자 결정, 구현 중)** — `notion_connections`(Task 6)는 **이번 단계에서 하지 않는다.**
> 이 테이블만 Owner Key 가 아닌 `NextAuth sub` 로 키가 잡혀 있어(설계 §4 의 "두 가지 의미"),
> 이관하면 기존 연결이 끊겨 1회 재연결이 필요하다. 옛 키를 그대로 들고 옮기는 대안은 **잘못된 키를
> 새 백엔드에 박아** 단계 7 에서 다시 옮기게 만든다. 둘 다 지금 치를 값이 아니라 미룬다.

**Architecture:** 단계 2~3 과 결정적으로 다른 점 하나 — 이 6개는 **이미 전부 서버측 경로**다. 브라우저 store 가 아니라 Next 라우트(`/api/brand-profile/[id]/products` 등)와 서버 전용 모듈(`cron-runs.ts`·`notion-store.ts`·`instagram-messages.ts`)이 `getSupabaseServer()` 를 직접 부른다. 따라서 **프론트 컴포넌트는 하나도 바뀌지 않고**, Next 라우트의 외부 계약도 동결한 채 그 **안쪽 구현만** Supabase → Spring 으로 갈아끼운다.

파일 저장은 Spring 이 로컬 파일시스템에 쓰고, DB 에는 **상대 경로**만 남긴다(설계 §5). 노출 URL 은 Next 라우트가 조립한다 — 호스팅이 바뀌어도 DB 를 고칠 일이 없다.

**Tech Stack:** 단계 3 과 동일 — Spring Boot 4.1.0 · Jackson 3 · Hibernate 7 · Testcontainers 2.0.5 · JDK 21 · H2(단위) / PostgreSQL 16(통합) · Next.js 16 · Vitest

## Global Constraints

- **와이어 형태 동결.** `ProductEntry`·`ReferenceMaterial` 의 TS 선언을 한 줄도 바꾸지 않는다. 안 맞으면 Java 를 고친다.
- **Next 라우트의 외부 계약 동결.** `/api/brand-profile/[id]/products` 는 지금처럼 **맨 배열**을 GET 으로 돌려주고, POST/PUT 은 `FormData(data, image)` 를 받는다. `/api/onboarding/status` 는 `{ok, onboarded}`. 이걸 지키면 컴포넌트 수정이 0이다.
- **훅 표면 동결.** `useProducts()`·`useReferenceMaterials()` 의 반환 형태(`{products, loading, save, remove, refresh}` / `{materials, loading, upload, remove, refresh}`)가 그대로여야 한다.
- `./gradlew test` 는 **Docker 없이** green (H2). Testcontainers 는 `./gradlew integrationTest` 로만.
- **회귀 기준선**: `npm test` **710 tests / 69 files**, `./gradlew test` **57건**, `./gradlew integrationTest` **15건**. 이 숫자가 줄면 회귀다.
- `npm run build` · `npx tsc --noEmit --project apps/web/tsconfig.json` 성공 유지.
- **둘러보기는 Spring 을 호출하지 않는다.** `isRealOwner()` 게이트 유지 (설계 §7).
- 새 의존성 **없음** (Gradle·npm 모두). 파일 저장은 `java.nio.file` 만 쓴다.
- 커밋 메시지는 `type(scope): 한국어 설명`. **`Co-Authored-By:` 트레일러 금지.** `git push` 금지.
- **단계 4 시작 전 롤백 태그**: `git tag pre-phase4`.

## 이 단계의 성과 지표

끝났을 때 아래가 참이어야 한다.

```bash
# getSupabaseServer() 호출은 둘만 남는다 — 토너먼트(단계 5)와 노션(범위 조정으로 유예)
grep -rln 'getSupabaseServer(' apps/web/src apps/web/app apps/web/lib | grep -v 'supabase-server.ts'
# → tournament/supabase-store.ts · shared/lib/notion-store.ts 두 파일만 나와야 한다

# 클라이언트 코드의 NEXT_PUBLIC_SUPABASE 참조는 0 이 된다
grep -rn 'NEXT_PUBLIC_SUPABASE' apps/web/src apps/web/app | grep -v 'supabase-server.ts' | wc -l   # → 0
```

`supabase-server.ts` 는 **삭제하지 않는다.** 토너먼트가 아직 쓴다. 단계 5 에서 함께 사라진다.

## 실측으로 확인된 사실

계획을 쓰기 전 코드를 읽어 확인했다. 추정이 아니다.

| 확인 항목 | 결과 |
|---|---|
| 단계 4 대상 6개의 위치 | **전부 서버측.** 브라우저가 이 테이블들을 직접 만지지 않는다 — 단계 3 에서 브라우저 직접 write 는 이미 소멸했다 |
| `products`·`reference_materials` 의 소유자 컬럼 | **없다.** `brand_profile_id` 로만 스코핑된다. 라우트도 세션을 보지 않는다 → **로그인한 아무나 남의 brandProfileId 로 조회·삭제할 수 있다.** 이관하면서 owner 스코프가 생긴다(의도된 편차 #2) |
| `useProducts` 의 로컬/서버 분기 | `NEXT_PUBLIC_SUPABASE_URL` 존재 여부 + `session.browseMode`. 단계 3 정정 메모대로 이 플래그가 아직 살아 있다 |
| `useReferenceMaterials` 의 분기 | `NEXT_PUBLIC_SUPABASE_URL` **단독**. `browseMode` 를 안 본다 — 게스트도 서버 라우트를 때린다. `isRealOwner` 로 바꾸면 함께 고쳐진다 |
| `buildBriefRefs` (AI 이미지 참고 자료) | **`data:` URL 만 받는다**(`splitDataUrl` 정규식). 즉 Supabase 모드에서 참고 자료는 이미 조용히 버려지고 있다. 단계 4 가 만든 문제가 아니고, 단계 4 가 고치지도 않는다 — 기록만 남긴다 |
| `notion_connections.user_key` | `jwtToken.sub ?? email ?? jti`. Facebook provider 의 `sub` 는 **email 이 아니다** — 설계 §4 "Owner Key 가 두 가지 의미로 쓰이고 있다" 의 실물. 이관하면 키가 email 로 통일되고 **기존 연결은 1회 재연결이 필요하다** |
| `cron_runs` | 소유자 없음. Vercel cron 이 세션 없이 호출한다 → JWT 가 아니라 **내부 시크릿**으로 지켜야 한다 |
| `ig_messages` | 소유자 없음. Meta webhook 이 세션 없이 호출한다 → 내부 시크릿. 단 **읽기 경로는 세션이 `session.igUserId` 를 이미 들고 있다** |
| `getThreadFromSupabase(conversationId)` | **`igUserId` 로 안 거른다.** 대화 id 만 알면 남의 DM 스레드가 나온다. 세션에 `igUserId` 가 있으므로 필터 한 줄로 닫힌다 |
| Spring 의 `brand_profiles` | 단계 2 에서 이미 `OwnerScoped` 로 산다. **파일 접근 인가를 여기에 물릴 수 있다** — 별도 소유 테이블이 필요 없다 |
| `EncryptedStringConverter` | 단계 1 에서 이미 있다(`MetaConnection.accessToken`). 노션 토큰에 그대로 재사용한다 |
| `StoreController` 재사용 가능성 | **4개는 안 된다.** products·reference-materials 는 `brandProfileId` 쿼리 스코프가 더 붙고, onboarding·notion-connection 은 컬렉션이 아니라 단일 문서다 |
| Next 라우트의 GET 응답 | products·reference-materials 모두 **맨 배열**(`{items}` 봉투 아님). 컴포넌트가 그렇게 읽는다 |

## 설계 문서와 다르게 가는 3가지 (검토 요청)

**1. 파일 저장에 인터페이스를 두지 않는다.** 설계 §5 는 "S3 호환으로 갈아끼울 수 있게 인터페이스 하나만 둔다" 고 했다. 구현은 **클래스 하나**(`FileStore`, 파일시스템)만 둔다. 구현체가 하나뿐인 인터페이스는 지금 아무것도 사지 못한다 — S3 로 갈아끼울 때 인터페이스를 뽑는 일이 지금 뽑아두는 일과 같은 크기다. 대신 **호출 표면을 좁게** 유지해(`save`/`read`/`delete`/`exists` 넷) 나중에 인터페이스를 뽑는 비용을 0에 가깝게 만든다.

**2. `products`·`reference_materials` 에 owner 스코프를 새로 건다.** 지금은 `brand_profile_id` 로만 걸러서 로그인한 아무나 남의 제품을 읽고 지울 수 있다. Spring 으로 옮기면서 `OwnerScoped` 를 상속시키고 JWT subject 로 한 겹 더 거른다. **동작이 바뀐다** — 단, 실제로 바뀌는 것은 "남의 것에 접근하던 경로"뿐이라 정상 사용에는 영향이 없다. 이관 순간이 이걸 고치는 가장 싼 시점이다.

**3. `ig_messages` 스레드 조회에 `igUserId` 필터를 더한다.** 위와 같은 부류다. 세션이 이미 `igUserId` 를 들고 있어 필터 한 줄이면 닫힌다.

셋 다 "이관하는 김에"가 아니라 **이관하지 않으면 Spring 쪽에 같은 구멍을 새로 파야 하는** 항목이다.

## 계약이 지켜주지 못하는 필드 (기록)

| 필드 | 이유 | 대신 지키는 것 |
|---|---|---|
| `ProductEntry.imageUrl` · `ReferenceMaterial.storageUrl` | Spring 은 **상대 경로**를 담고 Next 라우트가 `/api/files/...` 로 조립한다. 타입은 둘 다 `string` 이라 컴파일러가 이 의미 차이를 못 본다 | Next 라우트 단위 테스트(경로→URL 조립·`data:` 통과) |

나머지는 전부 스칼라라 `contract-compat.ts` 의 단언이 지킨다.

---

## File Structure

**apps/api — 신규**

| 경로 | 책임 |
|---|---|
| `storage/FileStore.java` | 파일시스템 저장. 경로 검증 포함 |
| `storage/FileController.java` | `GET/PUT/DELETE /files/{bucket}/{brandProfileId}/{name}` |
| `store/product/Product.java` · `ProductRepository.java` · `ProductController.java` | `/stores/products` |
| `store/material/ReferenceMaterial.java` · `ReferenceMaterialRepository.java` · `ReferenceMaterialController.java` | `/stores/reference-materials` |
| `store/onboarding/OnboardedUser.java` · `OnboardedUserRepository.java` · `OnboardingController.java` | `/stores/onboarding` |
| `store/notion/NotionConnection.java` · `NotionConnectionRepository.java` · `NotionConnectionController.java` | `/stores/notion-connection` |
| `internal/InternalSecret.java` | 내부 시크릿 검증 공용 (지금 `AuthExchangeController` 안에 사문화돼 있는 것을 끌어올린다) |
| `internal/cron/CronRun.java` · `CronRunRepository.java` · `CronRunController.java` | `/internal/cron-runs` |
| `internal/ig/IgMessage.java` · `IgMessageRepository.java` · `IgMessageController.java` | `/internal/ig-messages` |
| `src/test/java/.../{storage,store/product,store/material,store/onboarding,store/notion,internal/cron,internal/ig}/*Test.java` | 와이어·인가 검증 |
| `src/integrationTest/java/.../storage/FileStorePostgresIT.java` | 파일 왕복 + 경로 컬럼 실측 |

**apps/web — 수정**

| 경로 | 책임 |
|---|---|
| `src/shared/lib/backend/files.ts` (신규) | 파일 프록시 + 경로→URL 조립 |
| `app/api/files/[...path]/route.ts` (신규) | Spring `/files/**` 프록시 |
| `app/api/brand-profile/[id]/products/route.ts` · `[productId]/route.ts` | Spring 재배선 |
| `app/api/brand-profile/[id]/reference-materials/route.ts` · `[materialId]/route.ts` | Spring 재배선 |
| `app/api/onboarding/status/route.ts` | Spring 재배선 |
| `src/shared/lib/products.ts` · `referenceMaterials.ts` | 로컬/서버 분기를 `isRealOwner` 로 |
| `src/shared/lib/notion-store.ts` · `cron-runs.ts` | Spring 재배선 |
| `lib/instagram-messages.ts` · `app/api/instagram/webhook/route.ts` · `.../conversations/[id]/messages/route.ts` | Spring 재배선 + `igUserId` 스코프 |
| `src/shared/lib/backend/contract-compat.ts` | 신규 4종 호환성 단언 |

---

## Task 1: Spring 파일 저장 — `FileStore` 와 `/files/**`

버킷 2개를 인수하는 바닥이다. 여기서 **경로 검증**을 잘못하면 디렉터리 탈출이 열린다 — 이 태스크에서 게으르면 안 되는 유일한 지점이다.

인가 모델: 경로가 `{bucket}/{brandProfileId}/{name}` 이므로 **JWT 소유자가 그 brand profile 을 갖고 있는지**만 보면 된다. 단계 2 의 `brand_profiles` 가 이미 owner-scoped 라 조회 한 번이면 끝난다. 행이 아직 없는 신규 업로드에도 그대로 통한다(제품 행보다 브랜드 프로필이 먼저 존재한다).

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/storage/FileStore.java`
- Create: `apps/api/src/main/java/ai/adflow/api/storage/FileController.java`
- Modify: `apps/api/src/main/resources/application.yml`
- Test: `apps/api/src/test/java/ai/adflow/api/storage/FileControllerTest.java`

**Interfaces:**
- Consumes: 단계 2 의 `BrandProfileRepository`
- Produces:
  - `GET /files/{bucket}/{brandProfileId}/{name}` → 바이트 + `Content-Type`
  - `PUT /files/{bucket}/{brandProfileId}/{name}` → 원문 바디 저장, `{ "path": "bucket/bp/name" }`
  - `DELETE /files/{bucket}/{brandProfileId}/{name}` → `{ "ok": true }`
  - 남의 브랜드 프로필이면 전부 **403**

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/storage/FileControllerTest.java`:

```java
package ai.adflow.api.storage;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
class FileControllerTest {

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  /** 파일 인가는 브랜드 프로필 소유에 물려 있다. 먼저 프로필을 하나 만들어 둔다. */
  private void giveBrandProfile(String email, String id) throws Exception {
    mockMvc
        .perform(
            post("/stores/brand-profiles")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"" + id + "\",\"name\":\"브랜드\"}}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/files/product-images/bp_x/a.png")).andExpect(status().isUnauthorized());
  }

  @Test
  void 올린_파일이_그대로_돌아온다() throws Exception {
    giveBrandProfile("f@example.com", "bp_f");

    mockMvc
        .perform(
            put("/files/product-images/bp_f/p_1.png")
                .with(owner("f@example.com"))
                .contentType(MediaType.IMAGE_PNG)
                .content(new byte[] {1, 2, 3, 4}))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/files/product-images/bp_f/p_1.png").with(owner("f@example.com")))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.IMAGE_PNG))
        .andExpect(content().bytes(new byte[] {1, 2, 3, 4}));

    mockMvc
        .perform(delete("/files/product-images/bp_f/p_1.png").with(owner("f@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/files/product-images/bp_f/p_1.png").with(owner("f@example.com")))
        .andExpect(status().isNotFound());
  }

  @Test
  void 남의_브랜드_프로필_경로는_403() throws Exception {
    giveBrandProfile("mine@example.com", "bp_mine");

    mockMvc
        .perform(
            put("/files/product-images/bp_mine/x.png")
                .with(owner("other@example.com"))
                .contentType(MediaType.IMAGE_PNG)
                .content(new byte[] {9}))
        .andExpect(status().isForbidden());

    mockMvc
        .perform(get("/files/product-images/bp_mine/x.png").with(owner("other@example.com")))
        .andExpect(status().isForbidden());
  }

  @Test
  void 없는_브랜드_프로필도_403() throws Exception {
    // 존재하지 않는 프로필 id 로는 아무도 올릴 수 없다. 열어두면 owner 검증이 무의미해진다.
    mockMvc
        .perform(
            put("/files/product-images/bp_nobody/x.png")
                .with(owner("f@example.com"))
                .contentType(MediaType.IMAGE_PNG)
                .content(new byte[] {9}))
        .andExpect(status().isForbidden());
  }

  @Test
  void 허용되지_않은_버킷은_400() throws Exception {
    giveBrandProfile("b@example.com", "bp_b");
    mockMvc
        .perform(
            put("/files/etc/bp_b/x.png")
                .with(owner("b@example.com"))
                .contentType(MediaType.IMAGE_PNG)
                .content(new byte[] {9}))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 경로_탈출_시도는_400() throws Exception {
    giveBrandProfile("t@example.com", "bp_t");
    // 인코딩된 ../ 도 세그먼트 화이트리스트에서 걸려야 한다.
    mockMvc
        .perform(
            get("/files/product-images/bp_t/%2E%2E%2F%2E%2E%2Fapplication.yml")
                .with(owner("t@example.com")))
        .andExpect(status().isBadRequest());
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon --tests '*FileControllerTest'
```

기대: FAIL — `/files/**` 가 없어 401 또는 404.

- [ ] **Step 3: `FileStore` 를 만든다**

`apps/api/src/main/java/ai/adflow/api/storage/FileStore.java`:

```java
package ai.adflow.api.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * 파일 저장. 로컬은 파일시스템, 배포하면 S3 호환으로 갈아끼운다(설계 §5).
 *
 * <p>구현체가 하나뿐이라 인터페이스를 뽑지 않았다. 표면이 넷뿐이라 나중에 뽑는 비용이 거의 없다.
 *
 * <p>경로는 {bucket}/{brandProfileId}/{name} 3세그먼트로 고정한다. 세그먼트마다 화이트리스트를
 * 통과해야 하므로 ".." 도 인코딩된 "%2E%2E" 도 디렉터리를 벗어나지 못한다.
 */
@Component
public class FileStore {

  /** 설계 §5 의 버킷 2개. 이 목록 밖은 받지 않는다. */
  private static final Set<String> BUCKETS = Set.of("product-images", "reference-materials");

  private static final Pattern SEGMENT = Pattern.compile("[A-Za-z0-9._-]{1,128}");

  private final Path root;

  public FileStore(@Value("${app.storage.root}") String root) {
    this.root = Path.of(root).toAbsolutePath().normalize();
  }

  /** 검증된 상대 경로. DB 에 담기는 값이기도 하다 — 절대 URL 을 저장하지 않는다. */
  public String relativePath(String bucket, String brandProfileId, String name) {
    requireSegment(bucket);
    requireSegment(brandProfileId);
    requireSegment(name);
    if (!BUCKETS.contains(bucket)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알 수 없는 버킷이에요.");
    }
    return bucket + "/" + brandProfileId + "/" + name;
  }

  public void save(String relativePath, byte[] bytes) {
    Path target = resolve(relativePath);
    try {
      Files.createDirectories(target.getParent());
      Files.write(target, bytes);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 저장하지 못했어요.", e);
    }
  }

  public Optional<byte[]> read(String relativePath) {
    Path target = resolve(relativePath);
    if (!Files.isRegularFile(target)) return Optional.empty();
    try {
      return Optional.of(Files.readAllBytes(target));
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 읽지 못했어요.", e);
    }
  }

  public void delete(String relativePath) {
    try {
      Files.deleteIfExists(resolve(relativePath));
    } catch (IOException e) {
      // 지우기 실패는 본업을 막지 않는다 — 고아 파일이 남을 뿐이다.
    }
  }

  private Path resolve(String relativePath) {
    Path target = root.resolve(relativePath).normalize();
    // 세그먼트 검증을 이미 통과했으므로 여기 걸릴 일이 없다. 두 번째 자물쇠다.
    if (!target.startsWith(root)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 경로예요.");
    }
    return target;
  }

  private static void requireSegment(String s) {
    if (s == null || !SEGMENT.matcher(s).matches()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 경로예요.");
    }
  }
}
```

- [ ] **Step 4: `FileController` 를 만든다**

`apps/api/src/main/java/ai/adflow/api/storage/FileController.java`:

```java
package ai.adflow.api.storage;

import ai.adflow.api.store.brand.BrandProfileRepository;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 버킷 파일의 유일한 문. 인가는 브랜드 프로필 소유에 물려 있다 —
 * 경로에 brandProfileId 가 들어 있으므로 별도 소유 테이블이 필요 없다.
 */
@RestController
@RequestMapping("/files")
public class FileController {

  private final FileStore store;
  private final BrandProfileRepository brandProfiles;

  public FileController(FileStore store, BrandProfileRepository brandProfiles) {
    this.store = store;
    this.brandProfiles = brandProfiles;
  }

  @GetMapping("/{bucket}/{brandProfileId}/{name}")
  public ResponseEntity<byte[]> read(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name) {

    String path = authorize(jwt, bucket, brandProfileId, name);
    return store
        .read(path)
        .map(
            bytes ->
                ResponseEntity.ok()
                    .contentType(guessType(name))
                    .body(bytes))
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  @PutMapping("/{bucket}/{brandProfileId}/{name}")
  public Map<String, String> write(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name,
      @RequestHeader(value = "Content-Type", required = false) String contentType,
      @RequestBody byte[] bytes) {

    String path = authorize(jwt, bucket, brandProfileId, name);
    store.save(path, bytes);
    // 응답이 곧 DB 에 담길 값이다. 절대 URL 이 아니라 상대 경로다(설계 §5).
    return Map.of("path", path);
  }

  @DeleteMapping("/{bucket}/{brandProfileId}/{name}")
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String bucket,
      @PathVariable String brandProfileId,
      @PathVariable String name) {

    store.delete(authorize(jwt, bucket, brandProfileId, name));
    return Map.of("ok", true);
  }

  private String authorize(Jwt jwt, String bucket, String brandProfileId, String name) {
    String path = store.relativePath(bucket, brandProfileId, name);
    boolean mine =
        brandProfiles
            .findById(brandProfileId)
            .map(bp -> jwt.getSubject().equals(bp.getOwnerKey()))
            .orElse(false);
    if (!mine) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 브랜드 프로필의 파일이 아니에요.");
    }
    return path;
  }

  private static MediaType guessType(String name) {
    String lower = name.toLowerCase();
    if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG;
    if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
    if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF;
    if (lower.endsWith(".txt")) return MediaType.TEXT_PLAIN;
    return MediaType.APPLICATION_OCTET_STREAM;
  }
}
```

- [ ] **Step 5: 저장 루트를 설정에 넣는다**

`apps/api/src/main/resources/application.yml` 의 `app:` 아래에 추가한다.

```yaml
app:
  storage:
    # 버킷 파일 루트. 로컬은 파일시스템, 배포하면 S3 호환으로 교체(설계 §5).
    # 레포 밖에 두려면 ADFLOW_STORAGE_ROOT 로 덮어쓴다.
    root: ${ADFLOW_STORAGE_ROOT:./.adflow-files}
```

`apps/api/.gitignore` 에 `.adflow-files/` 를 추가한다. 없으면 만든다.

- [ ] **Step 6: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 기존 57건 + `FileControllerTest` 6건 = **63건**.

`남의_브랜드_프로필_경로는_403` 이 404 로 나오면 `authorize` 가 파일 존재를 먼저 보는 것이다 — 인가가 존재 확인보다 **앞서야** 남의 파일 유무가 새지 않는다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): 파일 저장소 · /files 엔드포인트 — 인가는 브랜드 프로필 소유에 물린다"
```

---

## Task 2: Spring `/stores/products`

`ProductEntry` 는 스칼라뿐이라 계약 예외가 없다. 다만 `StoreController` 를 못 쓴다 — `brandProfileId` 스코프가 한 겹 더 붙고 정렬이 `createdAt` 오름차순이다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/product/Product.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/product/ProductRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/product/ProductController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/product/ProductControllerTest.java`

**Interfaces:**
- Consumes: 단계 2 의 `OwnerScoped`·`ItemRequest`·`ItemsResponse`
- Produces:
  - `GET /stores/products?brandProfileId=` → `{items:[…]}`
  - `POST /stores/products` `{item}` → `{ok:true}`
  - `DELETE /stores/products?id=` → `{ok:true}`
  - 항목이 TS `ProductEntry`(`id`·`brandProfileId`·`name`·`description`·`imageUrl?`·`price?`·`targetUrl?`·`createdAt`)와 1:1

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/api/src/test/java/ai/adflow/api/store/product/ProductControllerTest.java`:

```java
package ai.adflow.api.store.product;

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
class ProductControllerTest {

  // TS ProductEntry 와 1:1. createdAt 은 epoch ms 숫자다(문자열 아님).
  private static final String ITEM =
      """
      {
        "id": "prod_1",
        "brandProfileId": "bp_1",
        "name": "수분 크림",
        "description": "가벼운 제형",
        "imageUrl": "product-images/bp_1/prod_1.png",
        "price": "29000",
        "targetUrl": "https://shop.example.com/1",
        "createdAt": 1750000000000
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
            post("/stores/products")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_1"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 스칼라가_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_1").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("prod_1"))
        .andExpect(jsonPath("$.items[0].brandProfileId").value("bp_1"))
        .andExpect(jsonPath("$.items[0].name").value("수분 크림"))
        // 상대 경로다. 절대 URL 을 저장하지 않는다(설계 §5).
        .andExpect(jsonPath("$.items[0].imageUrl").value("product-images/bp_1/prod_1.png"))
        .andExpect(jsonPath("$.items[0].price").value("29000"))
        // epoch ms 가 숫자로 나가야 한다. 문자열이 되면 화면 정렬이 깨진다.
        .andExpect(jsonPath("$.items[0].createdAt").value(1750000000000L))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 미설정_optional_은_키가_없다() throws Exception {
    save(
        "m@example.com",
        """
        {"id":"prod_min","brandProfileId":"bp_1","name":"최소","description":"","createdAt":1}
        """);

    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_1").with(owner("m@example.com")))
        .andExpect(jsonPath("$.items[0].imageUrl").doesNotExist())
        .andExpect(jsonPath("$.items[0].price").doesNotExist())
        .andExpect(jsonPath("$.items[0].targetUrl").doesNotExist());
  }

  @Test
  void 다른_브랜드_프로필_것은_안_섞인다() throws Exception {
    save("s@example.com", ITEM.replace("prod_1", "prod_a"));
    save("s@example.com", ITEM.replace("prod_1", "prod_b").replace("bp_1", "bp_2"));

    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_2").with(owner("s@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value("prod_b"));
  }

  @Test
  void 남의_제품은_보이지_않는다() throws Exception {
    // 의도된 편차 #2 — 지금(Supabase)은 brandProfileId 만 알면 남의 제품이 보인다.
    save("owner@example.com", ITEM.replace("prod_1", "prod_secret"));

    mockMvc
        .perform(
            get("/stores/products").param("brandProfileId", "bp_1").with(owner("thief@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 남의_제품은_지워지지_않는다() throws Exception {
    save("owner2@example.com", ITEM.replace("prod_1", "prod_keep"));

    mockMvc
        .perform(delete("/stores/products").param("id", "prod_keep").with(owner("thief@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/stores/products").param("brandProfileId", "bp_1").with(owner("owner2@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void 오래된_것부터_나온다() throws Exception {
    save("o@example.com", ITEM.replace("prod_1", "prod_new").replace("1750000000000", "2000"));
    save("o@example.com", ITEM.replace("prod_1", "prod_old").replace("1750000000000", "1000"));

    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_1").with(owner("o@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("prod_old"))
        .andExpect(jsonPath("$.items[1].id").value("prod_new"));
  }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon --tests '*ProductControllerTest'
```

기대: FAIL — `/stores/products` 없음.

- [ ] **Step 3: 엔티티·리포지토리를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/product/Product.java`:

```java
package ai.adflow.api.store.product;

import ai.adflow.api.store.OwnerScoped;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** TS: apps/web/src/shared/lib/products.ts 의 ProductEntry 와 필드 1:1. */
@Entity
@Table(name = "products")
public class Product extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(length = 2000)
  private String description;

  /** 버킷 상대 경로다(product-images/{bp}/{id}.png). 노출 URL 은 Next 라우트가 조립한다. */
  @Column(name = "image_url")
  private String imageUrl;

  private String price;

  @Column(name = "target_url")
  private String targetUrl;

  /** epoch ms. 클라가 만든 값이라 서버가 덮어쓰지 않는다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "created_at", nullable = false)
  private Long createdAt;

  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getDescription() { return description; }
  public void setDescription(String v) { this.description = v; }
  public String getImageUrl() { return imageUrl; }
  public void setImageUrl(String v) { this.imageUrl = v; }
  public String getPrice() { return price; }
  public void setPrice(String v) { this.price = v; }
  public String getTargetUrl() { return targetUrl; }
  public void setTargetUrl(String v) { this.targetUrl = v; }
  public Long getCreatedAt() { return createdAt; }
  public void setCreatedAt(Long v) { this.createdAt = v; }
}
```

`apps/api/src/main/java/ai/adflow/api/store/product/ProductRepository.java`:

```java
package ai.adflow.api.store.product;

import ai.adflow.api.store.OwnerScopedRepository;
import java.util.List;

public interface ProductRepository extends OwnerScopedRepository<Product> {

  /** 화면이 오래된 것부터 보여준다(기존 Supabase 라우트의 created_at asc 를 승계). */
  List<Product> findByOwnerKeyAndBrandProfileIdOrderByCreatedAtAsc(
      String ownerKey, String brandProfileId);
}
```

- [ ] **Step 4: 컨트롤러를 만든다**

`apps/api/src/main/java/ai/adflow/api/store/product/ProductController.java`:

```java
package ai.adflow.api.store.product;

import ai.adflow.api.store.ItemRequest;
import ai.adflow.api.store.ItemsResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * StoreController 를 못 쓴다 — brandProfileId 스코프가 한 겹 더 붙고 정렬 키가 다르다.
 * owner 는 항상 JWT subject 에서 온다. 본문의 값은 신뢰하지 않는다.
 */
@RestController
@RequestMapping("/stores/products")
public class ProductController {

  private final ProductRepository repository;

  public ProductController(ProductRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public ItemsResponse<Product> list(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("brandProfileId") String brandProfileId) {
    return new ItemsResponse<>(
        repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtAsc(
            jwt.getSubject(), brandProfileId));
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> upsert(
      @AuthenticationPrincipal Jwt jwt, @RequestBody ItemRequest<Product> body) {

    Product item = body.item();
    if (item == null || item.getId() == null || item.getId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "저장할 항목이 없어요.");
    }
    if (item.getBrandProfileId() == null || item.getBrandProfileId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "브랜드 프로필이 없어요.");
    }

    item.setOwnerKey(jwt.getSubject());
    item.setUpdatedAt(Instant.now());
    repository.deleteByIdAndOwnerKey(item.getId(), jwt.getSubject());
    repository.flush();
    repository.save(item);
    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("id") String id) {
    repository.deleteByIdAndOwnerKey(id, jwt.getSubject());
    return Map.of("ok", true);
  }
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 63 + 7 = **70건**.

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/products — owner 스코프 신설 · 이미지는 상대 경로 저장"
```

---

## Task 3: Spring `/stores/reference-materials`

Task 2 와 같은 모양이다. 다른 점은 정렬이 `uploadedAt` 내림차순이고 `type` 이 `image|pdf|txt` 판별값이라는 것뿐이다.

`type` 은 Java enum 으로 만들지 않고 **String 으로 둔다** — TS 쪽 유니온이 진실의 원천이고, Java enum 으로 옮기면 목록이 두 곳에 살아 드리프트한다(단계 3 의 `goalId` 와 같은 판단).

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/material/ReferenceMaterial.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/material/ReferenceMaterialRepository.java`
- Create: `apps/api/src/main/java/ai/adflow/api/store/material/ReferenceMaterialController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/material/ReferenceMaterialControllerTest.java`

**Interfaces:**
- Produces: `GET /stores/reference-materials?brandProfileId=` · `POST` · `DELETE ?id=`, 항목이 TS `ReferenceMaterial` 과 1:1

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`ProductControllerTest` 를 본떠 쓴다. 아래 3개는 반드시 넣는다.

```java
  private static final String ITEM =
      """
      {
        "id": "ref_1",
        "brandProfileId": "bp_1",
        "name": "브랜드북.pdf",
        "type": "pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 1048576,
        "storageUrl": "reference-materials/bp_1/ref_1.pdf",
        "uploadedAt": 1750000000000
      }
      """;

  @Test
  void 스칼라가_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);
    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_1")
                .with(owner("a@example.com")))
        .andExpect(jsonPath("$.items[0].type").value("pdf"))
        .andExpect(jsonPath("$.items[0].mimeType").value("application/pdf"))
        // 큰 파일 크기가 int 로 잘리면 안 된다.
        .andExpect(jsonPath("$.items[0].sizeBytes").value(1048576))
        .andExpect(jsonPath("$.items[0].storageUrl").value("reference-materials/bp_1/ref_1.pdf"))
        .andExpect(jsonPath("$.items[0].uploadedAt").value(1750000000000L))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 최신_업로드가_먼저_나온다() throws Exception {
    save("o@example.com", ITEM.replace("ref_1", "ref_old").replace("1750000000000", "1000"));
    save("o@example.com", ITEM.replace("ref_1", "ref_new").replace("1750000000000", "2000"));
    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_1")
                .with(owner("o@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("ref_new"));
  }

  @Test
  void 남의_자료는_보이지_않는다() throws Exception {
    save("owner@example.com", ITEM.replace("ref_1", "ref_secret"));
    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_1")
                .with(owner("thief@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }
```

`토큰이_없으면_401` 도 함께 쓴다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon --tests '*ReferenceMaterialControllerTest'
```

- [ ] **Step 3: 엔티티를 만든다**

`Product` 와 같은 모양이다. 필드만 다르다.

```java
@Entity
@Table(name = "reference_materials")
public class ReferenceMaterial extends OwnerScoped {

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "brand_profile_id", nullable = false)
  private String brandProfileId;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String name;

  /**
   * image|pdf|txt. Java enum 으로 만들지 않는다 — TS 유니온이 진실의 원천이고,
   * 옮기면 목록이 두 곳에 살아 드리프트한다(단계 3 의 goalId 와 같은 판단).
   */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  private String type;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "mime_type")
  private String mimeType;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "size_bytes")
  private Long sizeBytes;

  /** 버킷 상대 경로. 게스트 폴백의 data: URL 은 여기까지 오지 않는다(로컬에만 산다). */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "storage_url", length = 1024)
  private String storageUrl;

  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Column(name = "uploaded_at", nullable = false)
  private Long uploadedAt;

  // 게터/세터 (Product 와 동일 패턴)
}
```

리포지토리:

```java
public interface ReferenceMaterialRepository extends OwnerScopedRepository<ReferenceMaterial> {
  List<ReferenceMaterial> findByOwnerKeyAndBrandProfileIdOrderByUploadedAtDesc(
      String ownerKey, String brandProfileId);
}
```

컨트롤러는 `ProductController` 와 같다 — 경로와 정렬 메서드만 바꾼다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
```

기대: PASS. 70 + 4 = **74건**.

- [ ] **Step 5: 실제 Postgres 에서 파일·경로를 확인한다**

`apps/api/src/integrationTest/java/ai/adflow/api/storage/FileStorePostgresIT.java`:

```java
package ai.adflow.api.storage;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import ai.adflow.api.store.material.ReferenceMaterial;
import ai.adflow.api.store.material.ReferenceMaterialRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class FileStorePostgresIT extends IntegrationTestBase {

  @Autowired private FileStore store;
  @Autowired private ReferenceMaterialRepository repository;
  @Autowired private JdbcTemplate jdbc;

  @Test
  void 저장한_바이트가_그대로_돌아온다() {
    String path = store.relativePath("reference-materials", "bp_it", "ref_it.txt");
    store.save(path, "안녕".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    assertThat(store.read(path)).isPresent();
    assertThat(new String(store.read(path).orElseThrow(), java.nio.charset.StandardCharsets.UTF_8))
        .isEqualTo("안녕");
    store.delete(path);
    assertThat(store.read(path)).isEmpty();
  }

  @Test
  void DB_에는_절대_URL_이_아니라_상대_경로가_들어간다() {
    ReferenceMaterial m = new ReferenceMaterial();
    m.setId("ref_pg");
    m.setOwnerKey("pg@example.com");
    m.setUpdatedAt(Instant.now());
    m.setBrandProfileId("bp_pg");
    m.setName("자료.txt");
    m.setType("txt");
    m.setMimeType("text/plain");
    m.setSizeBytes(12L);
    m.setStorageUrl("reference-materials/bp_pg/ref_pg.txt");
    m.setUploadedAt(1L);
    repository.saveAndFlush(m);

    List<String> urls =
        jdbc.queryForList(
            "select storage_url from reference_materials where id = 'ref_pg'", String.class);
    // http 로 시작하면 호스팅을 바꿀 때 DB 마이그레이션이 필요해진다(설계 §5).
    assertThat(urls).singleElement().asString().doesNotStartWith("http");
  }
}
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew integrationTest --no-daemon
```

기대: PASS, 17건 (기존 15 + 신규 2).

- [ ] **Step 6: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/api
git commit -m "feat(api): /stores/reference-materials — 상대 경로 저장 · 파일 왕복 통합 검증"
```

---

## Task 4: Next 재배선 — 제품·참고 자료 라우트 4개 + `/api/files`

여기서 **경로 → URL 조립**이 일어난다. Spring 은 `product-images/bp_1/prod_1.png` 를 주고, Next 가 `/api/files/product-images/bp_1/prod_1.png` 로 바꿔 브라우저에 내려보낸다. 브라우저는 Spring 주소를 끝까지 모른다(설계 §3 백엔드 호출 격리).

**Files:**
- Create: `apps/web/src/shared/lib/backend/files.ts`
- Create: `apps/web/src/shared/lib/backend/files.test.ts`
- Create: `apps/web/app/api/files/[...path]/route.ts`
- Modify: `apps/web/app/api/brand-profile/[id]/products/route.ts` · `[productId]/route.ts`
- Modify: `apps/web/app/api/brand-profile/[id]/reference-materials/route.ts` · `[materialId]/route.ts`
- Modify: `apps/web/src/shared/lib/products.ts` · `referenceMaterials.ts`

**Interfaces:**
- Consumes: `backendBaseUrl()`·`refreshBackendToken()`·`isRealOwner()`
- Produces:
  - `toPublicUrl(path)` — 상대 경로를 `/api/files/…` 로. `data:`·`http`·`/` 로 시작하면 **그대로 통과**(게스트 폴백의 data URL·데모 시드 보호)
  - `callBackend(req, path, init)` — JSON 이 아닌 바디도 보낼 수 있는 백엔드 호출 (기존 `stores.ts` 의 `proxy` 는 GET/POST/DELETE 전용이라 재사용 못 한다)

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

`apps/web/src/shared/lib/backend/files.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toPublicUrl } from "./files";

describe("toPublicUrl", () => {
  it("버킷 상대 경로를 /api/files 로 조립해요", () => {
    expect(toPublicUrl("product-images/bp_1/p.png")).toBe("/api/files/product-images/bp_1/p.png");
  });

  it("data: URL 은 그대로 둬요", () => {
    // 게스트·오프라인 폴백은 base64 를 그대로 들고 있다. 접두사를 붙이면 이미지가 깨진다.
    expect(toPublicUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("절대 URL 과 절대 경로는 그대로 둬요", () => {
    // 데모 시드(/demo/…)와 이관 전 Supabase public URL 이 둘 다 여기로 온다.
    expect(toPublicUrl("https://x.supabase.co/a.png")).toBe("https://x.supabase.co/a.png");
    expect(toPublicUrl("/demo/library/serum.jpg")).toBe("/demo/library/serum.jpg");
  });

  it("빈 값은 undefined 예요", () => {
    expect(toPublicUrl(undefined)).toBeUndefined();
    expect(toPublicUrl("")).toBeUndefined();
  });
});
```

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/web && npx vitest run src/shared/lib/backend/files.test.ts
```

기대: FAIL — 모듈이 없다.

- [ ] **Step 2: `files.ts` 를 만든다**

`apps/web/src/shared/lib/backend/files.ts`:

```ts
// 버킷 파일의 경로↔URL 변환과 백엔드 호출. server-side 에서 쓰지만 toPublicUrl 은 순수 함수다.
//
// DB 에는 상대 경로만 산다(설계 §5). 노출 URL 을 여기서 조립하므로 호스팅이 바뀌어도
// DB 마이그레이션이 필요 없다.

const PUBLIC_PREFIX = "/api/files/";

export function toPublicUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  // data: 는 게스트 폴백, http/https 는 이관 전 Supabase public URL, / 는 데모 시드.
  if (path.startsWith("data:") || path.startsWith("http") || path.startsWith("/")) return path;
  return PUBLIC_PREFIX + path;
}

/** 노출 URL → 저장 경로. 클라가 되돌려 보낸 imageUrl 을 다시 DB 에 넣을 때 쓴다. */
export function toStoragePath(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith(PUBLIC_PREFIX) ? url.slice(PUBLIC_PREFIX.length) : url;
}
```

- [ ] **Step 3: 백엔드 호출을 `stores.ts` 에서 뽑아 공유한다**

`stores.ts` 의 `proxy` 는 JSON 전용이라 파일 바디를 못 보낸다. 토큰 꺼내기·401 재시도는 똑같으므로 **그 부분만** `callBackend` 로 뽑고 `stores.ts` 는 그것을 쓰게 고친다. 새 코드가 아니라 이동이다.

`apps/web/src/shared/lib/backend/call.ts` (신규):

```ts
// 백엔드 호출의 공통 몸통 — 토큰 꺼내기 · 401 시 1회 재발급 재시도.
// stores.ts 의 proxy 에서 뽑아냈다. 파일 라우트는 JSON 이 아닌 바디를 보내야 해서 공유가 필요했다.

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { isRealOwner } from "@shared/lib/store/ownerKey";
import { backendBaseUrl } from "./client";
import { refreshBackendToken } from "./refresh";

export type BackendCall =
  | { ok: true; res: Response }
  | { ok: false; status: 401 | 503; message: string };

export async function callBackend(
  req: NextRequest,
  path: string,
  init: { method: string; body?: BodyInit; contentType?: string } = { method: "GET" },
): Promise<BackendCall> {
  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!jwt || !isRealOwner(jwt.email as string | null | undefined) || !jwt.backendToken) {
    return { ok: false, status: 401, message: "로그인이 필요해요." };
  }

  const base = backendBaseUrl();
  if (!base) {
    return {
      ok: false,
      status: 503,
      message: "이 환경에서는 저장 기능을 쓸 수 없어요. 둘러보기 전용이에요.",
    };
  }

  const send = (token: string) =>
    fetch(`${base}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      ...(init.body === undefined ? {} : { body: init.body }),
    });

  let res = await send(jwt.backendToken as string);
  if (res.status === 401 && jwt.backendRefreshToken) {
    const issued = await refreshBackendToken(jwt.backendRefreshToken as string);
    if (issued) res = await send(issued.token);
  }
  return { ok: true, res };
}
```

`stores.ts` 의 `proxy` 는 이 함수를 쓰도록 줄인다. **`createStoreRoute` 의 외부 동작은 바뀌지 않는다** — 단계 2·3 의 store 8개가 그대로 돌아야 한다.

- [ ] **Step 4: `/api/files/[...path]` 프록시를 만든다**

`apps/web/app/api/files/[...path]/route.ts`:

```ts
// 버킷 파일의 브라우저 쪽 문. 브라우저는 Spring 주소를 모른다(설계 §3).

import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const call = await callBackend(req, `/files/${path.join("/")}`);
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });

  const body = await call.res.arrayBuffer();
  return new NextResponse(call.res.ok ? body : null, {
    status: call.res.status,
    headers: {
      "content-type": call.res.headers.get("content-type") ?? "application/octet-stream",
      // 경로에 항목 id 가 들어가고 덮어쓰기는 같은 경로를 재사용한다 — 길게 캐시하면 안 된다.
      "cache-control": "private, max-age=60",
    },
  });
}
```

- [ ] **Step 5: 제품 라우트 2개를 다시 배선한다**

`apps/web/app/api/brand-profile/[id]/products/route.ts` — 외부 계약(맨 배열 GET · FormData POST)은 그대로다.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { callBackend } from "@shared/lib/backend/call";
import { toPublicUrl, toStoragePath } from "@shared/lib/backend/files";

const BUCKET = "product-images";

type ProductRow = {
  id: string;
  brandProfileId: string;
  name: string;
  description: string;
  imageUrl?: string;
  price?: string;
  targetUrl?: string;
  createdAt: number;
};

function expose(row: ProductRow): ProductRow {
  return { ...row, imageUrl: toPublicUrl(row.imageUrl) };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await callBackend(req, `/stores/products?brandProfileId=${encodeURIComponent(id)}`);
  if (!call.ok) return NextResponse.json({ error: call.message }, { status: call.status });
  if (!call.res.ok) return NextResponse.json({ error: "조회에 실패했어요." }, { status: call.res.status });

  const { items } = (await call.res.json()) as { items: ProductRow[] };
  return NextResponse.json(items.map(expose));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const raw = form.get("data");
  if (typeof raw !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

  const entry = JSON.parse(raw) as ProductRow;
  const image = form.get("image");

  let imagePath = toStoragePath(entry.imageUrl);
  if (image instanceof File) {
    const ext = (image.name.split(".").pop() ?? "jpg").toLowerCase();
    const up = await callBackend(req, `/files/${BUCKET}/${id}/${entry.id}.${ext}`, {
      method: "PUT",
      body: await image.arrayBuffer(),
      contentType: image.type,
    });
    if (!up.ok) return NextResponse.json({ error: up.message }, { status: up.status });
    if (up.res.ok) imagePath = ((await up.res.json()) as { path: string }).path;
  }

  const row: ProductRow = { ...entry, brandProfileId: id, imageUrl: imagePath };
  const save = await callBackend(req, "/stores/products", {
    method: "POST",
    body: JSON.stringify({ item: row }),
    contentType: "application/json",
  });
  if (!save.ok) return NextResponse.json({ error: save.message }, { status: save.status });
  if (!save.res.ok) return NextResponse.json({ error: "저장에 실패했어요." }, { status: save.res.status });

  return NextResponse.json(expose(row));
}
```

`[productId]/route.ts` 의 `PUT` 은 POST 와 같은 몸통이다(백엔드가 upsert 라 구분이 없다). `DELETE` 는 확장자를 모르므로 **저장된 경로를 먼저 읽어** 그 파일만 지운다 — 지금처럼 `.jpg`·`.png`·`.webp` 를 찍어 맞히지 않는다.

```ts
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;

  // 확장자를 추측하지 않는다 — 저장된 경로가 진실이다.
  const list = await callBackend(req, `/stores/products?brandProfileId=${encodeURIComponent(id)}`);
  if (list.ok && list.res.ok) {
    const { items } = (await list.res.json()) as { items: ProductRow[] };
    const path = items.find((p) => p.id === productId)?.imageUrl;
    if (path && !path.startsWith("data:")) {
      await callBackend(req, `/files/${path}`, { method: "DELETE" });
    }
  }

  const del = await callBackend(req, `/stores/products?id=${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
  if (!del.ok) return NextResponse.json({ error: del.message }, { status: del.status });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: 참고 자료 라우트 2개를 다시 배선한다**

같은 모양이다. `POST` 는 파일이 필수이고 `id` 를 서버가 만든다(`ref_${crypto.randomUUID()}`). 형식·크기 검증(`ACCEPTED_MIME`·50MB)은 **그대로 남긴다** — 신뢰 경계의 입력 검증이라 줄이지 않는다.

`DELETE` 는 목록에서 `storageUrl` 을 찾아 그 파일을 지운다.

- [ ] **Step 7: 클라이언트 분기를 `isRealOwner` 로 바꾼다**

`products.ts`:

```ts
import { isRealOwner } from "@shared/lib/store/ownerKey";
// …
export function useProducts(brandProfileId: string) {
  const { data: session } = useSession();
  // 단계 4 — NEXT_PUBLIC_SUPABASE_URL 플래그를 걷어냈다. 실유저만 서버를 쓴다(설계 §7).
  const local = !isRealOwner(session?.user?.email);
```

`referenceMaterials.ts` 는 `useSession` 을 새로 들여온다(지금은 게스트도 서버 라우트를 때린다).

```ts
"use client";
import { useSession } from "next-auth/react";
import { isRealOwner } from "@shared/lib/store/ownerKey";
// …
export function useReferenceMaterials(brandProfileId: string) {
  const { data: session } = useSession();
  const local = !isRealOwner(session?.user?.email);
```

모듈 최상단의 `const useSupabase = …` 두 줄을 지우고, 본문의 `!useSupabase` 를 `local` 로 바꾼다. `local` 이 훅 안의 값이 됐으므로 `upload`·`remove` 의 `useCallback` 의존성 배열에 넣는다.

- [ ] **Step 8: 검증**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
npx tsc --noEmit --project apps/web/tsconfig.json
npm test -- --run 2>&1 | grep -E "Test Files|Tests "
grep -rn 'NEXT_PUBLIC_SUPABASE' apps/web/src apps/web/app | grep -v 'supabase-server.ts'
```

기대: tsc 에러 0 · `Tests 714 passed` (710 + files.test 4건) · grep 결과 없음.

- [ ] **Step 9: 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
git add apps/web
git commit -m "feat(web): 제품·참고 자료 Spring 재배선 — 상대 경로 저장 · /api/files 프록시 신설"
```

---

## Task 5: `onboarded_users`

가장 작다. 소유자당 0 또는 1행이라 컬렉션이 아니다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/onboarding/OnboardedUser.java` · `OnboardedUserRepository.java` · `OnboardingController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/onboarding/OnboardingControllerTest.java`
- Modify: `apps/web/app/api/onboarding/status/route.ts`

**Interfaces:**
- Produces: `GET /stores/onboarding` → `{onboarded: boolean}` · `POST` → `{ok:true}` · `DELETE` → `{ok:true}`

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```java
  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/onboarding")).andExpect(status().isUnauthorized());
  }

  @Test
  void 등록_전에는_false_등록_후에는_true() throws Exception {
    mockMvc
        .perform(get("/stores/onboarding").with(owner("n@example.com")))
        .andExpect(jsonPath("$.onboarded").value(false));

    mockMvc.perform(post("/stores/onboarding").with(owner("n@example.com"))).andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/onboarding").with(owner("n@example.com")))
        .andExpect(jsonPath("$.onboarded").value(true));
  }

  @Test
  void 두_번_등록해도_한_행이다() throws Exception {
    mockMvc.perform(post("/stores/onboarding").with(owner("d@example.com"))).andExpect(status().isOk());
    mockMvc.perform(post("/stores/onboarding").with(owner("d@example.com"))).andExpect(status().isOk());
    mockMvc
        .perform(get("/stores/onboarding").with(owner("d@example.com")))
        .andExpect(jsonPath("$.onboarded").value(true));
  }

  @Test
  void 남의_등록은_내_상태가_아니다() throws Exception {
    mockMvc.perform(post("/stores/onboarding").with(owner("x@example.com"))).andExpect(status().isOk());
    mockMvc
        .perform(get("/stores/onboarding").with(owner("y@example.com")))
        .andExpect(jsonPath("$.onboarded").value(false));
  }

  @Test
  void 삭제하면_false_로_돌아간다() throws Exception {
    mockMvc.perform(post("/stores/onboarding").with(owner("r@example.com"))).andExpect(status().isOk());
    mockMvc.perform(delete("/stores/onboarding").with(owner("r@example.com"))).andExpect(status().isOk());
    mockMvc
        .perform(get("/stores/onboarding").with(owner("r@example.com")))
        .andExpect(jsonPath("$.onboarded").value(false));
  }
```

- [ ] **Step 2: 엔티티·컨트롤러를 만든다**

```java
@Entity
@Table(name = "onboarded_users")
public class OnboardedUser {

  @Id
  @Column(name = "owner_key")
  private String ownerKey;

  @Column(name = "onboarded_at")
  private Instant onboardedAt;

  // 게터/세터
}
```

컨트롤러는 `/stores/onboarding` 에 GET/POST/DELETE 셋. POST 는 `save` 로 upsert(PK 가 ownerKey 라 자연 멱등).

- [ ] **Step 3: Next 라우트를 다시 배선한다**

`apps/web/app/api/onboarding/status/route.ts` — 외부 계약(`{ok, onboarded}`)은 동결한다. Meta 광고 계정 백필 분기(`hasMetaAdAccounts`)는 **그대로 남긴다** — 이관과 무관한 도메인 규칙이다.

`getSupabaseServer()` 호출 3곳이 `callBackend(req, "/stores/onboarding", …)` 로 바뀐다. `getServerSession` 은 `hasMetaAdAccounts` 에 필요한 `accessToken` 때문에 남는다. 다만 `callBackend` 는 `NextRequest` 를 요구하므로 **핸들러 시그니처에 `req: NextRequest` 를 추가**한다(현재는 인자 없음).

- [ ] **Step 4: 검증 · 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
cd /Users/jieunsse/jieunsse/dev/meta && npx tsc --noEmit --project apps/web/tsconfig.json
git add apps/api apps/web
git commit -m "feat(api,web): /stores/onboarding — onboarded_users 이관"
```

기대: `./gradlew test` **79건** (74 + 5).

---

## Task 6: `notion_connections` — 토큰 컬럼 암호화 (이번 단계에서 하지 않음)

> **유예됨.** 위 §Goal 의 범위 조정 참고. 아래 내용은 이 테이블을 옮기기로 결정할 때 그대로 쓴다.
> 그때까지 `notion-store.ts` 는 Supabase 를 계속 쓴다.

노션 액세스 토큰이 평문으로 앉아 있으면 안 된다. 단계 1 의 `EncryptedStringConverter` 를 그대로 쓴다.

**키가 바뀐다.** 지금은 `jwtToken.sub ?? email ?? jti` 이고 Facebook 의 `sub` 는 email 이 아니다. Spring 은 JWT subject(=Owner Key=email)로 통일한다. **기존 Supabase 의 노션 연결은 이관되지 않고, 사용자는 한 번 다시 연결해야 한다.** 설계 §4 가 "이관 시 함정"으로 예고한 항목이다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/store/notion/NotionConnection.java` · `NotionConnectionRepository.java` · `NotionConnectionController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/store/notion/NotionConnectionControllerTest.java`
- Test: `apps/api/src/integrationTest/java/ai/adflow/api/store/notion/NotionConnectionPostgresIT.java`
- Modify: `apps/web/src/shared/lib/notion-store.ts` + 노션 라우트 5개의 `userKey` 계산

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

단위 테스트는 왕복과 소유 격리를 본다.

```java
  private static final String ITEM =
      """
      {
        "accessToken": "secret_notion_token",
        "botId": "bot_1",
        "workspaceId": "ws_1",
        "workspaceName": "우리 워크스페이스",
        "workspaceIcon": "🗂"
      }
      """;

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/notion-connection")).andExpect(status().isUnauthorized());
  }

  @Test
  void 연결이_없으면_204() throws Exception {
    mockMvc
        .perform(get("/stores/notion-connection").with(owner("none@example.com")))
        .andExpect(status().isNoContent());
  }

  @Test
  void 저장한_연결이_그대로_돌아온다() throws Exception {
    save("a@example.com", ITEM);
    mockMvc
        .perform(get("/stores/notion-connection").with(owner("a@example.com")))
        .andExpect(jsonPath("$.accessToken").value("secret_notion_token"))
        .andExpect(jsonPath("$.workspaceName").value("우리 워크스페이스"))
        .andExpect(jsonPath("$.ownerKey").doesNotExist());
  }

  @Test
  void optional_이_없으면_키가_없다() throws Exception {
    save("m@example.com", "{\"accessToken\":\"t\"}");
    mockMvc
        .perform(get("/stores/notion-connection").with(owner("m@example.com")))
        .andExpect(jsonPath("$.botId").doesNotExist())
        .andExpect(jsonPath("$.workspaceIcon").doesNotExist());
  }

  @Test
  void 남의_연결은_보이지_않는다() throws Exception {
    save("owner@example.com", ITEM);
    mockMvc
        .perform(get("/stores/notion-connection").with(owner("thief@example.com")))
        .andExpect(status().isNoContent());
  }

  @Test
  void 끊으면_사라진다() throws Exception {
    save("d@example.com", ITEM);
    mockMvc.perform(delete("/stores/notion-connection").with(owner("d@example.com"))).andExpect(status().isOk());
    mockMvc
        .perform(get("/stores/notion-connection").with(owner("d@example.com")))
        .andExpect(status().isNoContent());
  }
```

통합 테스트는 **암호화가 실제로 걸렸는지**를 본다 — 이게 이 태스크의 핵심이다.

```java
  @Test
  void 액세스_토큰이_평문으로_저장되지_않는다() {
    NotionConnection c = new NotionConnection();
    c.setOwnerKey("pg@example.com");
    c.setAccessToken("secret_notion_token");
    c.setUpdatedAt(Instant.now());
    repository.saveAndFlush(c);

    String stored =
        jdbc.queryForObject(
            "select access_token from notion_connections where owner_key = 'pg@example.com'",
            String.class);
    assertThat(stored).isNotNull().isNotEqualTo("secret_notion_token");
    assertThat(repository.findById("pg@example.com").orElseThrow().getAccessToken())
        .isEqualTo("secret_notion_token");
  }
```

- [ ] **Step 2: 엔티티를 만든다**

```java
@Entity
@Table(name = "notion_connections")
public class NotionConnection {

  /**
   * 단계 4 에서 키가 바뀌었다 — 예전 user_key 는 NextAuth sub 이었고 Facebook 의 sub 는 email 이
   * 아니다(설계 §4 "Owner Key 가 두 가지 의미"). 여기서는 Owner Key(email) 하나로 통일한다.
   */
  @Id
  @Column(name = "owner_key")
  @JsonIgnore
  private String ownerKey;

  /** 노션 OAuth 토큰. 만료·갱신이 없어 한 번 새면 계속 유효하다 — 반드시 암호화한다. */
  @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
  @Convert(converter = EncryptedStringConverter.class)
  @Column(name = "access_token", length = 2048)
  private String accessToken;

  @Column(name = "bot_id") private String botId;
  @Column(name = "workspace_id") private String workspaceId;
  @Column(name = "workspace_name") private String workspaceName;
  @Column(name = "workspace_icon") private String workspaceIcon;
  @Column(name = "updated_at") private Instant updatedAt;

  // 게터/세터
}
```

컨트롤러: `GET` (없으면 204) · `POST {item}` · `DELETE`.

- [ ] **Step 3: Next 를 다시 배선한다**

`notion-store.ts` 의 3개 함수가 `userKey` 인자를 버리고 `NextRequest` 를 받는다 — 소유자는 이제 JWT 가 정한다. 호출부 5곳(`status`·`search`·`callback`·`disconnect`·`import`)에서 `jwtToken?.sub ?? email ?? jti` 계산을 지운다.

`callback` 은 세션 존재 확인이 필요하므로 `getToken` 자체는 남기되 `userKey` 계산만 없앤다(`if (!jwtToken) return fail("no_session")`).

- [ ] **Step 4: 검증 · 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon && ./gradlew integrationTest --no-daemon
cd /Users/jieunsse/jieunsse/dev/meta && npx tsc --noEmit --project apps/web/tsconfig.json
git add apps/api apps/web
git commit -m "feat(api,web): /stores/notion-connection — 토큰 컬럼 암호화 · 키를 Owner Key 로 통일"
```

기대: `./gradlew test` **85건** (79 + 6), `integrationTest` **18건** (17 + 1).

---

## Task 7: `cron_runs` — 내부 시크릿 경로

소유자가 없다. Vercel cron 이 세션 없이 호출하므로 JWT 로 지킬 수 없다. `/auth/exchange` 와 같은 **내부 시크릿** 방식을 쓴다.

지금 시크릿 검증은 `AuthExchangeController` 안에 갇혀 있다. 세 번째 사용처가 생겼으니 `internal/InternalSecret.java` 로 뽑는다 (`AuthExchangeController`·`AuthRefreshController` 도 이걸 쓰게 고친다 — 동작은 그대로).

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/internal/InternalSecret.java`
- Create: `apps/api/src/main/java/ai/adflow/api/internal/cron/CronRun.java` · `CronRunRepository.java` · `CronRunController.java`
- Modify: `apps/api/src/main/java/ai/adflow/api/security/SecurityConfig.java` (`/internal/**` permitAll)
- Test: `apps/api/src/test/java/ai/adflow/api/internal/cron/CronRunControllerTest.java`
- Modify: `apps/web/src/shared/lib/cron-runs.ts`

**Interfaces:**
- Produces:
  - `POST /internal/cron-runs` `{job, ok, scanned, settled, advanced, errors, startedAt}` → `{ok:true}`
  - `GET /internal/cron-runs/last-success?job=` → `CronRun` 또는 204
  - 시크릿이 틀리면 **401**

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```java
  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/internal/cron-runs/last-success").param("job", "tournament-poller"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 기록_전에는_204() throws Exception {
    mockMvc
        .perform(
            get("/internal/cron-runs/last-success")
                .param("job", "empty-job")
                .header("X-Internal-Secret", SECRET))
        .andExpect(status().isNoContent());
  }

  @Test
  void 마지막_성공만_돌려준다() throws Exception {
    record("j1", true, "2026-07-01T00:00:00Z");
    record("j1", false, "2026-07-02T00:00:00Z");   // 실패는 dead-man's switch 판정 대상이 아니다
    record("j1", true, "2026-07-03T00:00:00Z");

    mockMvc
        .perform(get("/internal/cron-runs/last-success").param("job", "j1").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.ok").value(true))
        .andExpect(jsonPath("$.started_at").value("2026-07-03T00:00:00Z"));
  }

  @Test
  void 다른_job_은_안_섞인다() throws Exception {
    record("j2", true, "2026-07-01T00:00:00Z");
    mockMvc
        .perform(get("/internal/cron-runs/last-success").param("job", "j3").header("X-Internal-Secret", SECRET))
        .andExpect(status().isNoContent());
  }
```

**주의 — 와이어 이름.** TS `CronRun` 은 `error_count`·`started_at`·`finished_at` 처럼 **snake_case** 다(Supabase 행을 그대로 쓰던 흔적). `health` 라우트가 그 이름으로 읽는다. Java 필드는 camelCase 로 두고 `@JsonProperty` 로 와이어 이름만 맞춘다. `Sop.domainUpdatedAt` 과 같은 처방이다.

- [ ] **Step 2: `InternalSecret` 을 뽑고 시큐리티를 연다**

```java
@Component
public class InternalSecret {

  private final byte[] expected;

  public InternalSecret(@Value("${app.internal-secret}") String secret) {
    this.expected = secret.getBytes(StandardCharsets.UTF_8);
  }

  /** 길이까지 상수 시간으로 비교한다. 틀리면 401. */
  public void require(String presented) {
    byte[] given = presented == null ? new byte[0] : presented.getBytes(StandardCharsets.UTF_8);
    if (expected.length == 0 || !MessageDigest.isEqual(expected, given)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "내부 호출이 아니에요.");
    }
  }
}
```

`SecurityConfig` 에 `/internal/**` 를 `permitAll` 로 더한다. 주석으로 **왜** 여는지 남긴다(JWT 이전 단계가 아니라 세션 없는 기계 호출이라서).

- [ ] **Step 3: 엔티티·컨트롤러를 만든다**

`cron_runs` 는 PK 가 없다(집계 only). JPA 는 PK 를 요구하므로 `@Id @GeneratedValue Long id` 를 더하고 `@JsonIgnore` 로 가린다 — 와이어에는 안 나간다.

- [ ] **Step 4: `cron-runs.ts` 를 다시 배선한다**

두 함수의 **시그니처와 계약을 동결**한다. `recordCronRun` 은 지금처럼 실패를 삼키고(관측 로그 실패가 폴러 본업을 깨면 안 된다), `getLastSuccessfulRun` 은 지금처럼 던진다(health 라우트가 그걸 본다).

여기서는 `callBackend` 를 못 쓴다 — `NextRequest` 도 사용자 JWT 도 없다. `backendBaseUrl()` + `internalSecret()` 로 직접 부른다.

- [ ] **Step 5: 검증 · 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
cd /Users/jieunsse/jieunsse/dev/meta && npx tsc --noEmit --project apps/web/tsconfig.json && npm test -- --run 2>&1 | grep -E "Tests "
git add apps/api apps/web
git commit -m "feat(api,web): /internal/cron-runs — 내부 시크릿 검증을 InternalSecret 으로 공용화"
```

기대: `./gradlew test` **83건** (79 + 4).

---

## Task 8: `ig_messages` — 내부 시크릿 + `igUserId` 스코프

webhook 은 세션이 없으므로 `cron_runs` 와 같은 내부 시크릿 경로다. 읽기 경로는 세션이 있지만 **모든 호출자가 Next 서버**라 문을 하나로 두는 편이 단순하다.

읽기에 `igUserId` 필터를 더한다(의도된 편차 #3). 세션이 이미 들고 있어 비용이 없다.

**Files:**
- Create: `apps/api/src/main/java/ai/adflow/api/internal/ig/IgMessage.java` · `IgMessageRepository.java` · `IgMessageController.java`
- Test: `apps/api/src/test/java/ai/adflow/api/internal/ig/IgMessageControllerTest.java`
- Modify: `apps/web/lib/instagram-messages.ts`
- Modify: `apps/web/app/api/instagram/webhook/route.ts`
- Modify: `apps/web/app/api/instagram/conversations/[id]/messages/route.ts`

**Interfaces:**
- Produces:
  - `POST /internal/ig-messages` `{items:[…]}` → 벌크 upsert (지금 `upsertMessages` 가 배열을 한 번에 넣는다)
  - `GET /internal/ig-messages?igUserId=` → 최신순 (인박스)
  - `GET /internal/ig-messages?igUserId=&conversationId=` → 오래된 순 (스레드)
  - `GET /internal/ig-messages/conversation-id?igUserId=&participantId=` → `{conversationId}` 또는 204 (webhook 의 역조회)

- [ ] **Step 1: 실패하는 테스트를 먼저 쓴다**

```java
  @Test
  void 시크릿이_없으면_401() throws Exception {
    mockMvc.perform(get("/internal/ig-messages").param("igUserId", "ig_1"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 인박스는_최신순_스레드는_오래된_순() throws Exception {
    upsert("""
      {"items":[
        {"id":"m1","igUserId":"ig_1","conversationId":"c1","participantId":"p1",
         "participantHandle":"minji","fromMe":false,"text":"안녕","createdAt":"2026-07-01T00:00:00Z"},
        {"id":"m2","igUserId":"ig_1","conversationId":"c1","participantId":"p1",
         "fromMe":true,"text":"네","createdAt":"2026-07-02T00:00:00Z"}
      ]}
      """);

    mockMvc
        .perform(get("/internal/ig-messages").param("igUserId", "ig_1").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items[0].id").value("m2"));

    mockMvc
        .perform(
            get("/internal/ig-messages")
                .param("igUserId", "ig_1")
                .param("conversationId", "c1")
                .header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items[0].id").value("m1"))
        .andExpect(jsonPath("$.items[0].participantHandle").value("minji"))
        // handle 이 없는 행에서 키가 임의로 채워지면 안 된다.
        .andExpect(jsonPath("$.items[1].participantHandle").doesNotExist());
  }

  @Test
  void 남의_igUserId_로는_같은_대화가_안_보인다() throws Exception {
    // 의도된 편차 #3 — 지금은 conversationId 만 알면 남의 스레드가 나온다.
    upsert("""
      {"items":[{"id":"s1","igUserId":"ig_owner","conversationId":"c_secret",
        "participantId":"p","fromMe":false,"text":"비밀","createdAt":"2026-07-01T00:00:00Z"}]}
      """);
    mockMvc
        .perform(
            get("/internal/ig-messages")
                .param("igUserId", "ig_other")
                .param("conversationId", "c_secret")
                .header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 같은_id_를_다시_넣으면_교체된다() throws Exception {
    upsert("""{"items":[{"id":"dup","igUserId":"ig_d","conversationId":"c","participantId":"p",
      "fromMe":false,"text":"처음","createdAt":"2026-07-01T00:00:00Z"}]}""");
    upsert("""{"items":[{"id":"dup","igUserId":"ig_d","conversationId":"c","participantId":"p",
      "fromMe":false,"text":"나중","createdAt":"2026-07-01T00:00:00Z"}]}""");
    mockMvc
        .perform(get("/internal/ig-messages").param("igUserId", "ig_d").header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].text").value("나중"));
  }

  @Test
  void 대화_id_역조회는_최근_것을_준다() throws Exception {
    upsert("""{"items":[{"id":"r1","igUserId":"ig_r","conversationId":"c_real","participantId":"p_r",
      "fromMe":false,"text":"x","createdAt":"2026-07-01T00:00:00Z"}]}""");
    mockMvc
        .perform(
            get("/internal/ig-messages/conversation-id")
                .param("igUserId", "ig_r")
                .param("participantId", "p_r")
                .header("X-Internal-Secret", SECRET))
        .andExpect(jsonPath("$.conversationId").value("c_real"));
  }
```

- [ ] **Step 2: 엔티티·컨트롤러를 만든다**

`IgMessage` 는 `id` PK(메시지 mid), `igUserId`·`conversationId`·`participantId`·`participantHandle?`·`fromMe`·`text?`·`attachmentUrl?`·`createdAt`(문자열 ISO — TS 가 문자열로 읽고 그대로 화면에 쓴다).

컨트롤러는 `InternalSecret.require()` 를 각 핸들러 앞에서 부른다.

- [ ] **Step 3: Next 3곳을 다시 배선한다**

`instagram-messages.ts`:
- `upsertMessages` / `getInboxFromSupabase` / `getThreadFromSupabase` 의 Supabase 호출을 `/internal/ig-messages` 호출로 바꾼다. 함수 이름에서 `Supabase` 를 뗀다(`getInboxFromStore`·`getThreadFromStore`).
- `getInstagramThread` 가 **캐시 조회 전에 `igUserId` 를 확정**하도록 순서를 바꾼다. 힌트가 없으면 페이지 토큰으로 해석하고, 그래도 없으면 캐시를 건너뛴다(mock 폴백은 그대로).

`webhook/route.ts`: `deriveConversationId` 는 `/internal/ig-messages/conversation-id` 를, upsert 는 `/internal/ig-messages` 를 부른다. 실패 삼킴 정책은 그대로 — webhook 은 Meta 에 즉시 200 을 줘야 한다.

`conversations/[id]/messages/route.ts`: 발송 성공 기록도 같은 엔드포인트로.

- [ ] **Step 4: 검증 · 커밋**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon
cd /Users/jieunsse/jieunsse/dev/meta && npx tsc --noEmit --project apps/web/tsconfig.json && npm test -- --run 2>&1 | grep -E "Tests "
git add apps/api apps/web
git commit -m "feat(api,web): /internal/ig-messages — DM 캐시 이관 · 스레드 조회에 igUserId 스코프"
```

기대: `./gradlew test` **88건** (83 + 5).

---

## Task 9: 계약 단언 · 문서 · 성과 지표

- [ ] **Step 1: 계약 타입을 다시 뽑고 단언을 더한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta && npm run contracts:generate   # 스크립트 이름은 package.json 확인
```

`contract-compat.ts` 에 더한다.

```ts
// 단계 4 — 나머지 테이블.
// imageUrl·storageUrl 은 서버가 상대 경로를 담고 Next 라우트가 /api/files/… 로 조립한다.
// 타입은 양쪽 다 string 이라 컴파일러가 이 의미 차이를 못 본다 — files.test.ts 가 지킨다.
export type ProductIsCompatible = Assert<AssignableTo<Api<"Product">, ProductEntry>>;
export type ReferenceMaterialIsCompatible = Assert<
  AssignableTo<Api<"ReferenceMaterial">, ReferenceMaterial>
>;
```

단언이 진짜 검증하는지 **역검증**한다 — Java 필드 하나를 잠깐 지워 `tsc` 가 깨지는지 본 뒤 되돌린다.

- [ ] **Step 2: 문서를 갱신한다**

- `.env.example`: `ADFLOW_STORAGE_ROOT` 추가. `NEXT_PUBLIC_SUPABASE_URL` 옆의 단계 3 주석을 고친다 — **이제 클라이언트는 안 쓰고 `supabase-server.ts`(토너먼트)만 쓴다.**
- `supabase/schema.sql`: 단계 4 에서 이관된 6개 테이블에 "단계 4 에서 Spring 으로 이관 — 여기 있는 정의는 이관 전 데이터 참조용" 주석을 단다. **지우지는 않는다**(단계 7 ETL 이 읽을 원본이다).
- `.document/adr/`: ADR 을 새로 쓰지 않는다. 이관은 설계 문서 §9 의 실행 순서를 따르는 것이지 새 결정이 아니다. 단 **키가 바뀐 노션 연결**은 ADR-043 에 한 줄 추가한다.

- [ ] **Step 3: 성과 지표를 확인한다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta
grep -rn 'getSupabaseServer(' apps/web/src apps/web/app apps/web/lib | grep -v 'supabase-server.ts'
# → tournament/supabase-store.ts 만
grep -rn 'NEXT_PUBLIC_SUPABASE' apps/web/src apps/web/app | grep -v 'supabase-server.ts' | wc -l
# → 0
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "docs(plan): 단계 4 계약 단언 · 이관 주석 — Supabase 잔존은 토너먼트 하나"
```

---

## Task 10: 로컬 통합 확인

단위 테스트가 못 보는 것 — 실제 HTTP·실제 파일·실제 Postgres 를 함께 통과시킨다.

- [ ] **Step 1: 띄운다**

```bash
cd /Users/jieunsse/jieunsse/dev/meta && docker compose up -d
cd apps/api && ./gradlew bootRun --args='--spring.profiles.active=local'   # 별 창
cd apps/web && npm run dev                                                 # 별 창
```

- [ ] **Step 2: curl 로 확인한다** (Spring 직접, JWT 는 `/auth/exchange` 로 발급)

| 확인 | 기대 |
|---|---|
| 남의 brandProfileId 로 `PUT /files/product-images/…` | **403** |
| `PUT /files/etc/…` (허용 밖 버킷) | **400** |
| `PUT` 후 `GET` 한 바이트 | 올린 것과 동일 |
| `GET /stores/products?brandProfileId=` 의 `imageUrl` | `product-images/…` (**`http` 로 시작하지 않음**) |
| 시크릿 없는 `GET /internal/cron-runs/last-success` | **401** |
| 시크릿 틀린 `POST /internal/ig-messages` | **401** |
| `GET /stores/notion-connection` (연결 없음) | **204** |
| DB 의 `notion_connections.access_token` | 평문이 아님 |
| `id` 없는 `POST /stores/products` | **400** (401 로 뒤바뀌지 않음 — 단계 2 의 `DispatcherType.ERROR` 회귀 확인) |

- [ ] **Step 3: 브라우저로 확인한다**

Facebook 로그인이 필요한 실사용 경로다. 로그인 후:

1. `/brand-profile/{id}/edit` 에서 **제품에 이미지를 올린다** → 목록에 이미지가 보이고, `<img src>` 가 `/api/files/product-images/…` 다.
2. 새로고침해도 이미지가 남는다(파일이 실제로 디스크에 있다).
3. 제품을 지운다 → `.adflow-files/product-images/{bp}/` 에서 파일이 사라진다.
4. **참고 자료** 탭에서 PDF 를 올리고 지운다.
5. 다른 브라우저(같은 계정)에서 제품·참고 자료가 보인다 — cross-device 가 이 이관의 실제 이득이다.
6. **둘러보기**로 들어가 같은 화면을 돈다 → Spring 요청 **0건**, `/api/files` 요청 **0건**(게스트는 data URL 을 로컬에서 읽는다).
7. `/connect` 에서 노션을 다시 연결한다(키가 바뀌어 1회 필요) → 워크스페이스 이름이 뜬다.

- [ ] **Step 4: 전체 회귀**

```bash
cd /Users/jieunsse/jieunsse/dev/meta/apps/api && ./gradlew test --no-daemon && ./gradlew integrationTest --no-daemon
cd /Users/jieunsse/jieunsse/dev/meta && npm test -- --run && npx tsc --noEmit --project apps/web/tsconfig.json && npm run build
```

---

## 완료 조건

- `./gradlew test` **88건** green (Docker 없이), `./gradlew integrationTest` **17건** green
- `npm test` **714건 이상** green, `tsc --noEmit` 에러 0, `npm run build` 성공
- `getSupabaseServer()` 호출이 **토너먼트·노션 2곳**만 남는다
- 클라이언트 코드의 `NEXT_PUBLIC_SUPABASE` 참조가 **0**
- DB 의 `image_url`·`storage_url` 이 **`http` 로 시작하지 않는다**
- 둘러보기가 Spring 을 **호출하지 않는다**

## 이 단계에서 하지 않는 것

- **`tournaments` 이관** — 단계 5.
- **`notion_connections` 이관** — 유예(위 범위 조정). 옮길 때 Task 6 을 그대로 실행한다.
- **`supabase-server.ts` 삭제** — 토너먼트와 노션이 아직 쓴다.
- **기존 Supabase 데이터 이사** — 단계 7 ETL. 단계 4 는 새 저장소를 만들 뿐이고, 옛 데이터는 Supabase 에 그대로 있다.
- **S3 어댑터** — 배포를 결정할 때. 지금은 파일시스템 하나.
- **`buildBriefRefs` 의 `data:` 전용 제약** — Supabase 시절부터 있던 별개 결함이다. 참고 자료가 AI 이미지 생성에 안 실리는 문제는 이 단계가 만들지도 고치지도 않는다. 고치려면 서버가 파일을 읽어 base64 로 넣어야 하는데, 그건 이관이 아니라 기능 변경이다.
- **Flyway** — 설계 §10 부채. 배포 결정 시점.
