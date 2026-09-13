package ai.adflow.api.storage;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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

  private String signature(String path, String expires) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec("test-internal-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return HexFormat.of().formatHex(mac.doFinal(("PUT\n" + path + "\n" + expires).getBytes(StandardCharsets.UTF_8)));
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
  void 공개_미디어는_로그인없이_읽고_업로드는_인증이_필요하다() throws Exception {
    String name = "123e4567-e89b-42d3-a456-426614174000.png";
    String path = "/files/published-media/" + name;
    String expires = String.valueOf(Instant.now().plusSeconds(60).getEpochSecond());
    byte[] bytes = new byte[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

    mockMvc
        .perform(
            put(path)
                .queryParam("expires", expires)
                .queryParam("signature", signature(path, expires))
                .contentType(MediaType.IMAGE_PNG)
                .content(bytes))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/files/published-media/" + name))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.IMAGE_PNG))
        .andExpect(content().bytes(bytes));

    mockMvc
        .perform(
            put(path)
                .with(owner("media@example.com"))
                .contentType(MediaType.IMAGE_PNG)
                .content(bytes))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 짧은_서명은_로그인없이_직접_업로드하고_덮어쓰기는_막는다() throws Exception {
    String name = "123e4567-e89b-42d3-a456-426614174001.png";
    String path = "/files/published-media/" + name;
    String expires = String.valueOf(Instant.now().plusSeconds(60).getEpochSecond());
    String signature = signature(path, expires);
    byte[] bytes = new byte[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

    mockMvc
        .perform(
            put(path)
                .queryParam("expires", expires)
                .queryParam("signature", signature)
                .contentType(MediaType.IMAGE_PNG)
                .content(bytes))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            put(path)
                .queryParam("expires", expires)
                .queryParam("signature", signature)
                .contentType(MediaType.IMAGE_PNG)
                .content(bytes))
        .andExpect(status().isConflict());
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

    // 인가가 존재 확인보다 앞서야 남의 파일 유무가 새지 않는다(404 가 나오면 안 된다).
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

    // 인코딩된 슬래시는 Spring 방화벽이 라우팅 전에 막는다(우리 코드까지 오지 않는다).
    mockMvc
        .perform(get("/files/product-images/bp_t/..%2F..%2Fapplication.yml").with(owner("t@example.com")))
        .andExpect(status().isBadRequest());

    // 이쪽은 라우팅을 통과해 우리 세그먼트 화이트리스트가 직접 막아야 한다.
    mockMvc
        .perform(get("/files/product-images/bp_t/p@1.png").with(owner("t@example.com")))
        .andExpect(status().isBadRequest());
  }
}
