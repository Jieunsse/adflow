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
        .perform(
            get("/stores/products").param("brandProfileId", "bp_1").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].id").value("prod_1"))
        .andExpect(jsonPath("$.items[0].brandProfileId").value("bp_1"))
        .andExpect(jsonPath("$.items[0].name").value("수분 크림"))
        // 상대 경로다. 절대 URL 을 저장하지 않는다(설계 §5).
        .andExpect(jsonPath("$.items[0].imageUrl").value("product-images/bp_1/prod_1.png"))
        .andExpect(jsonPath("$.items[0].price").value("29000"))
        .andExpect(jsonPath("$.items[0].targetUrl").value("https://shop.example.com/1"))
        // epoch ms 가 숫자로 나가야 한다. 문자열이 되면 화면 정렬이 깨진다.
        .andExpect(jsonPath("$.items[0].createdAt").value(1750000000000L))
        .andExpect(jsonPath("$.items[0].ownerKey").doesNotExist());
  }

  @Test
  void 미설정_optional_은_키가_없다() throws Exception {
    save(
        "m@example.com",
        """
        {"id":"prod_min","brandProfileId":"bp_min","name":"최소","description":"","createdAt":1}
        """);

    mockMvc
        .perform(
            get("/stores/products").param("brandProfileId", "bp_min").with(owner("m@example.com")))
        .andExpect(jsonPath("$.items[0].imageUrl").doesNotExist())
        .andExpect(jsonPath("$.items[0].price").doesNotExist())
        .andExpect(jsonPath("$.items[0].targetUrl").doesNotExist());
  }

  @Test
  void 다른_브랜드_프로필_것은_안_섞인다() throws Exception {
    save("s@example.com", ITEM.replace("prod_1", "prod_a"));
    save("s@example.com", ITEM.replace("prod_1", "prod_b").replace("bp_1", "bp_2"));

    mockMvc
        .perform(
            get("/stores/products").param("brandProfileId", "bp_2").with(owner("s@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value("prod_b"));
  }

  @Test
  void 남의_제품은_보이지_않는다() throws Exception {
    // 의도된 편차 #2 — 지금(Supabase)은 brandProfileId 만 알면 남의 제품이 보인다.
    save("owner@example.com", ITEM.replace("prod_1", "prod_secret").replace("bp_1", "bp_secret"));

    mockMvc
        .perform(
            get("/stores/products")
                .param("brandProfileId", "bp_secret")
                .with(owner("thief@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void 남의_제품은_지워지지_않는다() throws Exception {
    save("owner2@example.com", ITEM.replace("prod_1", "prod_keep").replace("bp_1", "bp_keep"));

    mockMvc
        .perform(delete("/stores/products").param("id", "prod_keep").with(owner("thief@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(
            get("/stores/products")
                .param("brandProfileId", "bp_keep")
                .with(owner("owner2@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1));
  }

  @Test
  void 오래된_것부터_나온다() throws Exception {
    save(
        "o@example.com",
        ITEM.replace("prod_1", "prod_new").replace("bp_1", "bp_o").replace("1750000000000", "2000"));
    save(
        "o@example.com",
        ITEM.replace("prod_1", "prod_old").replace("bp_1", "bp_o").replace("1750000000000", "1000"));

    mockMvc
        .perform(get("/stores/products").param("brandProfileId", "bp_o").with(owner("o@example.com")))
        .andExpect(jsonPath("$.items[0].id").value("prod_old"))
        .andExpect(jsonPath("$.items[1].id").value("prod_new"));
  }

  @Test
  void id_가_없으면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/products")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"brandProfileId\":\"bp_1\",\"name\":\"이름만\"}}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void brandProfileId_가_없으면_400() throws Exception {
    // 없으면 어떤 목록에도 안 잡히는 유령 행이 된다.
    mockMvc
        .perform(
            post("/stores/products")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"id\":\"prod_ghost\",\"name\":\"유령\"}}"))
        .andExpect(status().isBadRequest());
  }
}
