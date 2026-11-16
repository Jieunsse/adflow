package ai.adflow.api.meta;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.tournament.engine.AdKpi;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 골든 픽스처 — Meta 응답 파싱이 TS 와 같은지 지킨다 (단계 6).
 *
 * <p>대응 TS: apps/web/lib/meta-insights-golden.test.ts
 *
 * <p>원본(raw)은 손으로 적은 입력이고 기대값(expected)은 TS 클라이언트에서 떠낸 것이다. ad study 결과
 * 파서의 <b>관대함</b>(셀 이름 정규화·confidence/p_value 폴백)과 KPI 반올림이 이 파일의 계약이다.
 */
class MetaInsightsGoldenTest {

  private static final ObjectMapper JSON = new ObjectMapper();

  /** 전송을 가로채 미리 정한 응답을 돌려준다. */
  static class StubGraphClient extends MetaGraphClient {
    private final String response;

    StubGraphClient(String response) {
      super(JSON, MetaGraphClient.GRAPH);
      this.response = response;
    }

    @Override
    protected String send(String method, String path, Map<String, Object> body) {
      return response;
    }
  }

  private static JsonNode fixture() {
    try (InputStream in = MetaInsightsGoldenTest.class.getResourceAsStream("/meta/insights.json")) {
      if (in == null) throw new IllegalStateException("픽스처가 클래스패스에 없어요: /meta/insights.json");
      return JSON.readTree(in);
    } catch (java.io.IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @Test
  void 픽스처가_비어_있지_않다() {
    assertThat(fixture().get("adStudy").size()).isGreaterThanOrEqualTo(10);
    assertThat(fixture().get("adInsights").size()).isGreaterThanOrEqualTo(5);
  }

  @TestFactory
  List<DynamicTest> ad_study_결과_파싱이_TS_와_같다() {
    List<DynamicTest> tests = new ArrayList<>();
    for (JsonNode c : fixture().get("adStudy")) {
      tests.add(
          DynamicTest.dynamicTest(
              c.get("name").asString(),
              () -> {
                MetaInsightsClient client =
                    new MetaInsightsClient(new StubGraphClient(JSON.writeValueAsString(c.get("raw"))));
                MetaInsightsClient.StudyResult got = client.splitTestResult("s1", "TOKEN");

                JsonNode want = c.get("expected");
                if (want == null || want.isNull()) {
                  assertThat(got).isNull();
                  return;
                }
                assertThat(got).isNotNull();
                JsonNode wantWinner = want.get("winner");
                assertThat(got.winner())
                    .isEqualTo(wantWinner == null || wantWinner.isNull() ? null : wantWinner.asString());
                assertThat(got.confidence()).isEqualTo(want.get("confidence").asDouble());
              }));
    }
    return tests;
  }

  @TestFactory
  List<DynamicTest> 광고별_KPI_파싱이_TS_와_같다() {
    List<DynamicTest> tests = new ArrayList<>();
    for (JsonNode c : fixture().get("adInsights")) {
      tests.add(
          DynamicTest.dynamicTest(
              c.get("name").asString(),
              () -> {
                MetaInsightsClient client =
                    new MetaInsightsClient(new StubGraphClient(JSON.writeValueAsString(c.get("raw"))));
                List<String> adIds = new ArrayList<>();
                for (JsonNode id : c.get("adIds")) adIds.add(id.asString());

                List<AdKpi> got = client.roundAdKpis("camp_1", "TOKEN", adIds);

                JsonNode want = c.get("expected");
                assertThat(got).hasSize(want.size());
                for (int i = 0; i < want.size(); i++) {
                  JsonNode w = want.get(i);
                  assertThat(got.get(i).impressions()).isEqualTo(w.get("impressions").asInt());
                  assertThat(got.get(i).clicks()).isEqualTo(w.get("clicks").asInt());
                  assertThat(got.get(i).ctr()).isEqualTo(w.get("ctr").asDouble());
                  assertThat(got.get(i).spend()).isEqualTo(w.get("spend").asDouble());
                }
              }));
    }
    return tests;
  }
}
