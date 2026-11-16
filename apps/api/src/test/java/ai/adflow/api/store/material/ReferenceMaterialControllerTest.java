package ai.adflow.api.store.material;

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
class ReferenceMaterialControllerTest {

  // TS ReferenceMaterial 과 1:1. uploadedAt 은 epoch ms 숫자다.
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

  @Autowired private MockMvc mockMvc;

  private RequestPostProcessor owner(String email) {
    return jwt()
        .jwt(j -> j.subject(email).claim("email", email).claim("roles", java.util.List.of("LEAD")))
        .authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  private void save(String email, String item) throws Exception {
    mockMvc
        .perform(
            post("/stores/reference-materials")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc
        .perform(get("/stores/reference-materials").param("brandProfileId", "bp_1"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 스칼라가_그대로_왕복한다() throws Exception {
    save("a@example.com", ITEM);

    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_1")
                .with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("브랜드북.pdf"))
        .andExpect(jsonPath("$.items[0].type").value("pdf"))
        .andExpect(jsonPath("$.items[0].mimeType").value("application/pdf"))
        // 큰 파일 크기가 int 로 잘리면 안 된다.
        .andExpect(jsonPath("$.items[0].sizeBytes").value(1048576))
        // 상대 경로다. 절대 URL 을 저장하지 않는다(설계 §5).
        .andExpect(jsonPath("$.items[0].storageUrl").value("reference-materials/bp_1/ref_1.pdf"))
        .andExpect(jsonPath("$.items[0].uploadedAt").value(1750000000000L))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 최신_업로드가_먼저_나온다() throws Exception {
    save(
        "o@example.com",
        ITEM.replace("ref_1", "ref_old").replace("bp_1", "bp_o").replace("1750000000000", "1000"));
    save(
        "o@example.com",
        ITEM.replace("ref_1", "ref_new").replace("bp_1", "bp_o").replace("1750000000000", "2000"));

    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_o")
                .with(owner("o@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("ref_new"))
        .andExpect(jsonPath("$.items[1].id").value("ref_old"));
  }

  @Test
  void 다른_브랜드_프로필_것은_안_섞인다() throws Exception {
    save("s@example.com", ITEM.replace("ref_1", "ref_a"));
    save("s@example.com", ITEM.replace("ref_1", "ref_b").replace("bp_1", "bp_2"));

    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_2")
                .with(owner("s@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value("ref_b"));
  }

  @Test
  void 남의_자료는_보이지_않는다() throws Exception {
    // 의도된 편차 #2 — 지금(Supabase)은 brandProfileId 만 알면 남의 자료가 보인다.
    save("owner@example.com", ITEM.replace("ref_1", "ref_secret").replace("bp_1", "bp_secret"));

    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_secret")
                .with(owner("thief@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 남의_자료는_지워지지_않는다() throws Exception {
    save("owner2@example.com", ITEM.replace("ref_1", "ref_keep").replace("bp_1", "bp_keep"));

    mockMvc
        .perform(
            delete("/stores/reference-materials")
                .param("id", "ref_keep")
                .with(owner("thief@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/stores/reference-materials")
                .param("brandProfileId", "bp_keep")
                .with(owner("owner2@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void id_가_없으면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/reference-materials")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"brandProfileId\":\"bp_1\",\"name\":\"이름만\"}}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void brandProfileId_가_없으면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/reference-materials")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"ref_ghost\",\"name\":\"유령\"}}"))
        .andExpect(status().isBadRequest());
  }
}
