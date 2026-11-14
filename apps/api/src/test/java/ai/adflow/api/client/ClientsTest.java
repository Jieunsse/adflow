package ai.adflow.api.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ai.adflow.api.store.brand.BrandProfileRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 고객사 영업·청구 기록 (기능 14, 정책서 27절, 회계 문서 2.2·2.3). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ClientsTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private BrandProfileRepository profiles;
  @Autowired private Billing billing;

  private static RequestPostProcessor as(String email, String role) {
    return jwt().jwt(j -> j.subject(email).claim("email", email))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }

  private String create(String lead, String json) throws Exception {
    String res =
        mockMvc
            .perform(post("/clients").with(as(lead, "LEAD")).contentType(MediaType.APPLICATION_JSON).content(json))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stage").value("inquiry"))
            .andReturn().getResponse().getContentAsString();
    return JsonPath.read(res, "$.id");
  }

  private org.springframework.test.web.servlet.ResultActions stage(String lead, String id, String to) throws Exception {
    return mockMvc.perform(
        post("/clients/" + id + "/stage").with(as(lead, "LEAD")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"stage\":\"" + to + "\"}"));
  }

  @Test
  void 해지_정산은_30일_전_통보와_첫_3개월_할인분을_반영한다() {
    LocalDate start = LocalDate.of(2026, 1, 1);
    // 회계 문서 2.2 예시: 2개월째 첫날에 알리면 2개월째까지 청구하고, 3개월을 못 채웠으니 할인분을 더한다.
    var s = Billing.settle(590_000, start, LocalDate.of(2026, 2, 1), LocalDate.of(2026, 2, 1));
    assertThat(s.effectiveEnd()).isEqualTo("2026-02-28");
    assertThat(s.lastContractMonth()).isEqualTo(2);
    assertThat(s.clawback()).isEqualTo(295_000);

    var early = Billing.settle(590_000, start, LocalDate.of(2026, 1, 10), LocalDate.of(2026, 1, 10));
    assertThat(early.lastContractMonth()).isEqualTo(2);
    assertThat(early.clawback()).isEqualTo(295_000);

    var late = Billing.settle(590_000, start, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 5, 31));
    assertThat(late.lastContractMonth()).isEqualTo(5);
    assertThat(late.clawback()).isZero();
  }

  @Test
  void 받지_않는_업종은_상담으로_넘길_수_없고_계약하면_브랜드가_생긴다() throws Exception {
    String banned = create("cl1@example.com", "{\"name\":\"도박\",\"excludedIndustry\":true}");
    stage("cl1@example.com", banned, "consult").andExpect(status().isBadRequest());

    String id = create("cl1@example.com", "{\"name\":\"오늘의꽃\",\"inquirySource\":\"meta_ad\"}");
    stage("cl1@example.com", id, "consult").andExpect(status().isOk());
    String res = stage("cl1@example.com", id, "contract").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    String brand = JsonPath.read(res, "$.brandProfileId");
    assertThat(profiles.findById(brand).orElseThrow().getName()).isEqualTo("오늘의꽃");
  }

  @Test
  void 메모는_쌓이기만_하고_청구는_팀장만_본다() throws Exception {
    String id = create("cl2@example.com", "{\"name\":\"숲\"}");
    mockMvc
        .perform(
            post("/workspace/members").with(as("cl2@example.com", "LEAD")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"cl2pm@example.com\",\"role\":\"팀원·게재\"}"))
        .andExpect(status().isOk());

    mockMvc
        .perform(post("/clients/" + id + "/memos").with(as("cl2pm@example.com", "MEMBER_PUBLISH"))
            .contentType(MediaType.APPLICATION_JSON).content("{\"body\":\"첫 통화\"}"))
        .andExpect(jsonPath("$.author").value("cl2pm@example.com"));
    mockMvc
        .perform(get("/clients/" + id + "/memos").with(as("cl2@example.com", "LEAD")))
        .andExpect(jsonPath("$.items[0].body").value("첫 통화"));

    mockMvc
        .perform(get("/clients/" + id + "/bills").with(as("cl2pm@example.com", "MEMBER_PUBLISH")))
        .andExpect(status().isForbidden());

    // 기한이 지난 청구가 있으면 목록에 연체로 보인다 (직원도 연체 여부는 본다).
    mockMvc
        .perform(put("/clients/" + id + "/bills").with(as("cl2@example.com", "LEAD"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"contractMonth\":1,\"amount\":295000,\"dueDate\":\"2020-01-10\"}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/clients/" + id).with(as("cl2pm@example.com", "MEMBER_PUBLISH")))
        .andExpect(jsonPath("$.overdue").value(true));
  }

  @Test
  void 연체가_30일을_넘은_고객사의_브랜드는_연체_일수가_30_이상이다() throws Exception {
    String id = create("cl3@example.com", "{\"name\":\"바다\"}");
    String res = stage("cl3@example.com", id, "contract").andReturn().getResponse().getContentAsString();
    String brand = JsonPath.read(res, "$.brandProfileId");
    String ws = JsonPath.read(
        mockMvc.perform(get("/me").with(as("cl3@example.com", "LEAD"))).andReturn().getResponse().getContentAsString(),
        "$.workspaceId");
    assertThat(billing.overdueDays(ws, brand)).isZero();

    mockMvc
        .perform(put("/clients/" + id + "/bills").with(as("cl3@example.com", "LEAD"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"contractMonth\":1,\"dueDate\":\"" + LocalDate.now().minusDays(40) + "\"}"))
        .andExpect(status().isOk());
    assertThat(billing.overdueDays(ws, brand)).isGreaterThanOrEqualTo(Billing.BLOCK_AFTER_DAYS);
  }
}
