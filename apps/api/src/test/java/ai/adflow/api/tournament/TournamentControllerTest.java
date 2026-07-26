package ai.adflow.api.tournament;

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
class TournamentControllerTest {

  /** TS Tournament 와 1:1. 중첩 6종이 전부 들어간 최대 모양이다. */
  private static final String FULL =
      """
      {
        "id": "tourn_full",
        "brandProfileId": "bp_1",
        "productId": "prod_1",
        "productName": "수분 크림",
        "tone": "warm",
        "objective": "traffic",
        "mode": "auto",
        "dailyBudget": 30000,
        "champion": {"headline": "챔피언 헤드", "primaryText": "챔피언 카피"},
        "championCtr": 1.8,
        "championSource": "existing",
        "championSourceName": "여름 캠페인",
        "championConfirmed": true,
        "pendingChallenger": {"headline": "챌린저 헤드", "primaryText": "챌린저 카피", "imageUrl": "x.png"},
        "pendingHypothesis": {
          "id": "hyp_p", "lever": "benefit", "statement": "혜택을 먼저 말하면 CTR이 오른다",
          "predictedMetric": "CTR", "predictedDirection": "up", "rationale": "근거",
          "rationaleSource": "ledger",
          "contextTags": {"productId": "prod_1", "objective": "traffic"},
          "status": "proposed"
        },
        "envelope": {
          "totalBudget": 500000, "targetDate": "2026-08-31",
          "autoRefill": {"addBudget": 100000, "hardCap": 900000},
          "stopOnDefendStreak": 3
        },
        "prohibitedWords": ["최저가", "1위"],
        "brandDescription": "브랜드 설명",
        "productDescription": "제품 설명",
        "variationIntensity": "bold",
        "axisCursor": 2,
        "rounds": [
          {
            "index": 1, "axis": "headline", "campaignId": "browse_tourn_tourn_full_r1",
            "champion": {"headline": "A", "primaryText": "AP"},
            "challenger": {"headline": "B", "primaryText": "AP"},
            "fastForwardDays": 7,
            "verdict": {"state": "winner", "ctrA": 1.8, "ctrB": 2.4, "confidence": 0.97},
            "rawWinner": "B",
            "adKpis": [
              {"ctr": 1.8, "impressions": 15000, "clicks": 270, "spend": 91911},
              {"ctr": 2.4, "impressions": 15000, "clicks": 360, "spend": 91911}
            ],
            "adIds": ["ad_a", "ad_b"],
            "adSetIds": ["set_a", "set_b"],
            "studyId": "study_1",
            "launchedAt": "2026-07-02T00:00:00Z",
            "status": "settled",
            "hypothesis": {
              "id": "hyp_r1", "lever": "rush", "statement": "긴박감을 주면 CTR이 오른다",
              "predictedMetric": "CTR", "predictedDirection": "up", "rationale": "근거",
              "rationaleSource": "platform-prior",
              "contextTags": {"productId": "prod_1", "personaId": "persona_1", "objective": "traffic"},
              "status": "resolved", "verdict": "confirmed", "effectSize": 33.3,
              "resolvedAt": "2026-07-09T00:00:00Z"
            }
          },
          {
            "index": 2, "axis": "primary_text", "campaignId": "browse_tourn_tourn_full_r2",
            "champion": {"headline": "B", "primaryText": "AP"},
            "challenger": {"headline": "B", "primaryText": "BP"},
            "fastForwardDays": 0, "status": "running"
          }
        ],
        "spentBudget": 210000,
        "status": "running",
        "createdAt": "2026-07-01T00:00:00Z",
        "delivery": {
          "accessToken": "EAAG_secret_long_lived",
          "adAccountId": "act_123", "pageId": "page_1", "ownerEmail": "a@example.com",
          "goalId": "traffic", "linkUrl": "https://shop.example.com",
          "ctaType": "LEARN_MORE", "countries": ["KR"], "ageMin": 25, "ageMax": 44,
          "genders": [2], "roundDays": 7
        },
        "lastError": "게재에 실패했어요"
      }
      """;

  /** 둘러보기 시뮬 경로의 최소 모양 — optional 이 전부 빠졌다. */
  private static final String MINIMAL =
      """
      {
        "id": "tourn_min",
        "brandProfileId": "bp_min",
        "productId": "prod_1",
        "productName": "제품",
        "tone": "warm",
        "objective": "traffic",
        "mode": "auto",
        "dailyBudget": 10000,
        "champion": {"headline": "H", "primaryText": "P"},
        "championCtr": 1.8,
        "axisCursor": 0,
        "rounds": [],
        "spentBudget": 0,
        "status": "running",
        "createdAt": "2026-07-01T00:00:00Z"
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
            post("/stores/tournaments")
                .with(owner(email))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":" + item + "}"))
        .andExpect(status().isOk());
  }

  @Test
  void 토큰이_없으면_401() throws Exception {
    mockMvc.perform(get("/stores/tournaments")).andExpect(status().isUnauthorized());
  }

  @Test
  void 중첩_6종이_그대로_왕복한다() throws Exception {
    save("a@example.com", FULL);

    mockMvc
        .perform(get("/stores/tournaments/tourn_full").with(owner("a@example.com")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("tourn_full"))
        .andExpect(jsonPath("$.champion.headline").value("챔피언 헤드"))
        .andExpect(jsonPath("$.pendingChallenger.imageUrl").value("x.png"))
        .andExpect(jsonPath("$.pendingHypothesis.lever").value("benefit"))
        .andExpect(jsonPath("$.pendingHypothesis.contextTags.productId").value("prod_1"))
        .andExpect(jsonPath("$.envelope.totalBudget").value(500000))
        .andExpect(jsonPath("$.envelope.autoRefill.hardCap").value(900000))
        .andExpect(jsonPath("$.envelope.stopOnDefendStreak").value(3))
        .andExpect(jsonPath("$.prohibitedWords[1]").value("1위"))
        .andExpect(jsonPath("$.variationIntensity").value("bold"))
        // 라운드 순서가 곧 의미다(1-based index). 순서가 뒤집히면 캐스케이드가 어긋난다.
        .andExpect(jsonPath("$.rounds[0].index").value(1))
        .andExpect(jsonPath("$.rounds[1].index").value(2))
        .andExpect(jsonPath("$.rounds[0].verdict.confidence").value(0.97))
        .andExpect(jsonPath("$.rounds[0].rawWinner").value("B"))
        .andExpect(jsonPath("$.rounds[0].adKpis[1].clicks").value(360))
        .andExpect(jsonPath("$.rounds[0].adIds[0]").value("ad_a"))
        .andExpect(jsonPath("$.rounds[0].adSetIds[1]").value("set_b"))
        .andExpect(jsonPath("$.rounds[0].hypothesis.verdict").value("confirmed"))
        .andExpect(jsonPath("$.rounds[0].hypothesis.contextTags.personaId").value("persona_1"))
        .andExpect(jsonPath("$.rounds[0].hypothesis.effectSize").value(33.3))
        .andExpect(jsonPath("$.delivery.adAccountId").value("act_123"))
        .andExpect(jsonPath("$.delivery.countries[0]").value("KR"))
        .andExpect(jsonPath("$.delivery.genders[0]").value(2))
        // 장기 토큰은 암호화 컬럼이지만 와이어에는 평문으로 돌아와야 폴러가 쓸 수 있다.
        .andExpect(jsonPath("$.delivery.accessToken").value("EAAG_secret_long_lived"))
        .andExpect(jsonPath("$.lastError").value("게재에 실패했어요"))
        // 서버 전용 필드가 새면 안 된다.
        .andExpect(jsonPath("$.ownerKey").doesNotExist())
        .andExpect(jsonPath("$.rounds[0].id").doesNotExist())
        .andExpect(jsonPath("$.delivery.id").doesNotExist());
  }

  @Test
  void 미설정_optional_은_키가_없다() throws Exception {
    save("m@example.com", MINIMAL);

    mockMvc
        .perform(get("/stores/tournaments/tourn_min").with(owner("m@example.com")))
        .andExpect(status().isOk())
        // 빈 임베더블이 {} 로 새 나가면 TS 의 optional(키 부재)과 어긋난다.
        .andExpect(jsonPath("$.envelope").doesNotExist())
        .andExpect(jsonPath("$.pendingChallenger").doesNotExist())
        .andExpect(jsonPath("$.pendingHypothesis").doesNotExist())
        .andExpect(jsonPath("$.delivery").doesNotExist())
        .andExpect(jsonPath("$.prohibitedWords").doesNotExist())
        .andExpect(jsonPath("$.completionReason").doesNotExist())
        .andExpect(jsonPath("$.lastError").doesNotExist())
        .andExpect(jsonPath("$.championConfirmed").doesNotExist())
        // rounds 는 required 다 — null 로 뭉개지면 화면이 .filter 에서 깨진다.
        .andExpect(jsonPath("$.rounds").isArray())
        .andExpect(jsonPath("$.rounds.length()").value(0));
  }

  @Test
  void 미결산_라운드는_verdict_가_없다() throws Exception {
    save("v@example.com", FULL.replace("tourn_full", "tourn_v"));

    mockMvc
        .perform(get("/stores/tournaments/tourn_v").with(owner("v@example.com")))
        .andExpect(jsonPath("$.rounds[1].status").value("running"))
        .andExpect(jsonPath("$.rounds[1].verdict").doesNotExist())
        .andExpect(jsonPath("$.rounds[1].rawWinner").doesNotExist())
        .andExpect(jsonPath("$.rounds[1].adKpis").doesNotExist())
        .andExpect(jsonPath("$.rounds[1].hypothesis").doesNotExist());
  }

  @Test
  void mode_는_항상_auto_다() throws Exception {
    // ADR-054 — 레거시 manual-n 행을 흡수하지 않으면 폴러가 그 토너먼트를 건너뛰어 조용히 멈춘다.
    save("g@example.com", MINIMAL.replace("tourn_min", "tourn_legacy").replace("\"auto\"", "\"manual-3\""));

    mockMvc
        .perform(get("/stores/tournaments/tourn_legacy").with(owner("g@example.com")))
        .andExpect(jsonPath("$.mode").value("auto"));
  }

  @Test
  void 남의_토너먼트는_보이지_않는다() throws Exception {
    save("owner@example.com", FULL.replace("tourn_full", "tourn_secret"));

    mockMvc
        .perform(get("/stores/tournaments/tourn_secret").with(owner("thief@example.com")))
        .andExpect(status().isNotFound());

    mockMvc
        .perform(get("/stores/tournaments").with(owner("thief@example.com")))
        .andExpect(jsonPath("$.items").isEmpty());
  }

  @Test
  void brandProfileId_로_좁힐_수_있다() throws Exception {
    // ADR-047 Ledger 투영 입력.
    save("s@example.com", MINIMAL.replace("tourn_min", "tourn_a").replace("bp_min", "bp_x"));
    save("s@example.com", MINIMAL.replace("tourn_min", "tourn_b").replace("bp_min", "bp_y"));

    mockMvc
        .perform(
            get("/stores/tournaments").param("brandProfileId", "bp_y").with(owner("s@example.com")))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value("tourn_b"));
  }

  @Test
  void 재저장하면_라운드가_교체된다() throws Exception {
    // 클라가 항상 전체 애그리거트를 보낸다 — 자식이 누적되면 라운드가 두 배로 늘어난다.
    save("r@example.com", FULL.replace("tourn_full", "tourn_r"));
    save("r@example.com", FULL.replace("tourn_full", "tourn_r"));

    mockMvc
        .perform(get("/stores/tournaments/tourn_r").with(owner("r@example.com")))
        .andExpect(jsonPath("$.rounds.length()").value(2));
  }

  @Test
  void id_가_없으면_400() throws Exception {
    mockMvc
        .perform(
            post("/stores/tournaments")
                .with(owner("a@example.com"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"item\":{\"brandProfileId\":\"bp_1\",\"status\":\"running\"}}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void 남의_토너먼트는_지워지지_않는다() throws Exception {
    save("k@example.com", MINIMAL.replace("tourn_min", "tourn_keep"));

    mockMvc
        .perform(delete("/stores/tournaments").param("id", "tourn_keep").with(owner("thief@example.com")))
        .andExpect(status().isOk());

    mockMvc
        .perform(get("/stores/tournaments/tourn_keep").with(owner("k@example.com")))
        .andExpect(status().isOk());
  }
}
