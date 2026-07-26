package ai.adflow.api.tournament;

import ai.adflow.api.internal.NextInternalClient;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * 챌린저 카피 생성. TS: server-runner.ts 의 genCreative → gemini-creative.ts.
 *
 * <p>Gemini 는 Java 로 옮기지 않는다 — 프롬프트가 화면 생성 경로와 같은 파일에 살고, 옮기면 같은
 * 한국어 프롬프트가 두 곳에서 갈라진다(설계 §6 도 Meta 만 재작성 대상으로 적었다).
 */
@Component
public class ChallengerCopyClient {

  /** 헤드라인·본문 후보 묶음. 레버에 따라 한쪽만 쓰인다(buildLeverChallenger). */
  public record Copy(List<String> headlines, List<String> primaryTexts) {}

  private final NextInternalClient next;

  public ChallengerCopyClient(NextInternalClient next) {
    this.next = next;
  }

  public Copy generate(Tournament t) {
    Map<String, Object> body = new HashMap<>();
    body.put("brand", blankTo(t.getBrandDescription(), t.getProductName()));
    body.put("target", blankTo(t.getProductDescription(), t.getProductName()));
    body.put("tone", t.getTone());
    body.put("outcome", t.getObjective());
    body.put("productName", t.getProductName());
    body.put("productDescription", blankTo(t.getProductDescription(), t.getProductName()));
    if (t.getVariationIntensity() != null) body.put("variationIntensity", t.getVariationIntensity());
    // ADR-054 — 금칙어는 생성 단계에서 구조로 배제한다(사후 필터가 아니다).
    if (t.getProhibitedWords() != null) body.put("prohibitedWords", t.getProhibitedWords());

    JsonNode res = next.post("/api/internal/creative/challenger", body);
    return new Copy(strings(res.get("headlines")), strings(res.get("primaryTexts")));
  }

  private static String blankTo(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private static List<String> strings(JsonNode arr) {
    List<String> out = new ArrayList<>();
    if (arr != null && arr.isArray()) for (JsonNode n : arr) out.add(n.asString());
    return out;
  }
}
