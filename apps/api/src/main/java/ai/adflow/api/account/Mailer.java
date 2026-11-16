package ai.adflow.api.account;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 메일 보내기 — Resend HTTP API. 키가 없으면(로컬·시험) 보내지 않고 링크를 로그에 남긴다. 그래서 키를 받기 전에도
 * 가입·재설정 흐름을 끝까지 시험할 수 있다.
 */
@Component
public class Mailer {

  private static final Logger log = LoggerFactory.getLogger(Mailer.class);

  private final RestClient http = RestClient.create();
  private final String apiKey;
  private final String from;

  public Mailer(@Value("${app.mail.resend-key:}") String apiKey, @Value("${app.mail.from:}") String from) {
    this.apiKey = apiKey;
    this.from = from;
  }

  public void send(String to, String subject, String text) {
    if (apiKey == null || apiKey.isBlank() || from == null || from.isBlank()) {
      log.info("[메일 미설정 — 보내지 않음] 받는 사람={} 제목={}\n{}", to, subject, text);
      return;
    }
    http.post()
        .uri("https://api.resend.com/emails")
        .header("Authorization", "Bearer " + apiKey)
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("from", from, "to", List.of(to), "subject", subject, "text", text))
        .retrieve()
        .toBodilessEntity();
  }
}
