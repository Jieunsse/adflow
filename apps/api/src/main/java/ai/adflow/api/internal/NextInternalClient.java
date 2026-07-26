package ai.adflow.api.internal;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Spring → Next 내부 호출. 내부 시크릿으로 지킨다(반대 방향의 /internal/** 과 같은 자물쇠).
 *
 * <p>단계 6 이 지운 것은 <b>Meta</b> 역위임이다. 남은 두 갈래는 성격이 다르다 —
 *
 * <ul>
 *   <li>챌린저 카피 생성: Gemini 프롬프트 521줄이 화면 생성 경로와 공유된다. Java 로 옮기면 같은
 *       한국어 프롬프트가 두 곳에 살아 드리프트한다. 설계 §6 도 Meta 만 재작성 대상으로 적었다.
 *   <li>SSE 알림: 열린 커넥션이 Next 프로세스 <b>메모리</b>에 있다(설계 §6). 다른 프로세스에서 닿을
 *       방법이 없어 다리가 필수다.
 * </ul>
 */
@Component
public class NextInternalClient {

  private final RestClient http = RestClient.create();
  private final ObjectMapper json;
  private final String baseUrl;
  private final String secret;

  public NextInternalClient(
      ObjectMapper json,
      @Value("${app.next-internal-url:}") String baseUrl,
      @Value("${app.internal-secret}") String secret) {
    this.json = json;
    this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
    this.secret = secret;
  }

  public boolean configured() {
    return !baseUrl.isEmpty();
  }

  public JsonNode post(String path, Map<String, Object> body) {
    if (baseUrl.isEmpty()) {
      throw new IllegalStateException("app.next-internal-url 이 없어 Next 를 호출할 수 없어요.");
    }
    String raw =
        http.post()
            .uri(baseUrl + path)
            .header("X-Internal-Secret", secret)
            .contentType(MediaType.APPLICATION_JSON)
            .body(json.writeValueAsString(body))
            .retrieve()
            .body(String.class);
    return json.readTree(raw == null || raw.isBlank() ? "{}" : raw);
  }
}
