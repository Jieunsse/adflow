package ai.adflow.api.meta;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Meta 그래프 전송 계층. TS: lib/meta-ads-graph.ts 의 graphFetch.
 *
 * <p>Meta 는 HTTP 200 에 {@code {"error": …}} 를 실어 보낸다 — 상태 코드로 실패를 판정할 수 없어
 * 본문을 열어봐야 한다. 그래서 RestClient 의 기본 오류 처리에 기대지 않고 직접 본다.
 *
 * <p>테스트가 갈아끼울 수 있도록 send 를 protected 로 둔다. 실 계정 없이 검증해야 하는 코드라
 * 전송을 스텁하고 <b>요청 바디를 골든 픽스처와 대조</b>하는 것이 유일한 방어선이다.
 */
@Component
public class MetaGraphClient {

  /** TS 와 같은 그래프 버전. 올릴 때 TS·Java 를 같이 올려야 한다. */
  public static final String GRAPH = "https://graph.facebook.com/v20.0";

  private final RestClient http = RestClient.create();
  private final ObjectMapper json;
  private final String graphBase;

  public MetaGraphClient(ObjectMapper json, @Value("${app.meta.graph-base:" + GRAPH + "}") String graphBase) {
    this.json = json;
    this.graphBase = graphBase;
  }

  /** POST /{path} — 바디에 access_token 을 섞어 보낸다(TS 와 같은 방식). */
  public JsonNode post(String path, Map<String, Object> body, String token) {
    Map<String, Object> withToken = new LinkedHashMap<>(body);
    withToken.put("access_token", token);
    return check(send("POST", path, withToken));
  }

  /** GET /{path} — 쿼리스트링은 호출자가 만든다(필드 목록·filtering 이 경로마다 달라서). */
  public JsonNode get(String path) {
    return check(send("GET", path, null));
  }

  /** 실패한 게재를 되돌린다. 정리 실패는 호출자가 삼킨다 — 원래 오류를 가리면 안 된다. */
  public void delete(String path) {
    check(send("DELETE", path, null));
  }

  protected String send(String method, String path, Map<String, Object> body) {
    String url = path.startsWith("http") ? path : graphBase + path;
    RestClient.RequestBodySpec spec = http.method(org.springframework.http.HttpMethod.valueOf(method)).uri(url);
    if (body != null) {
      spec = spec.contentType(MediaType.APPLICATION_JSON).body(json.writeValueAsString(body));
    }
    return spec.retrieve().body(String.class);
  }

  private JsonNode check(String raw) {
    JsonNode node = json.readTree(raw == null || raw.isBlank() ? "{}" : raw);
    JsonNode error = node.get("error");
    if (error == null || error.isNull()) return node;

    int code = error.path("code").asInt(0);
    Integer subcode = error.has("error_subcode") ? error.get("error_subcode").asInt() : null;
    String userMsg = error.has("error_user_msg") ? error.get("error_user_msg").asString() : null;

    StringBuilder detail = new StringBuilder();
    if (subcode != null) detail.append("subcode=").append(subcode);
    if (userMsg != null) detail.append(detail.isEmpty() ? "" : " | ").append(userMsg);
    if (error.has("error_data")) {
      detail.append(detail.isEmpty() ? "" : " | ").append("data=").append(error.get("error_data").asString());
    }

    String message =
        "Meta API 오류 (" + code + "): " + error.path("message").asString("")
            + (detail.isEmpty() ? "" : " — " + detail);
    throw new MetaApiException(message, code, subcode, userMsg);
  }
}
