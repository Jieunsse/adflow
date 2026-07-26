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
