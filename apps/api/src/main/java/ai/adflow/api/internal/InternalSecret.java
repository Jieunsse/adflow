package ai.adflow.api.internal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Next.js 서버만 아는 값. JWT 로 지킬 수 없는 경로가 쓴다 — 토큰 발급 이전 단계(/auth/**)와
 * 세션 없는 기계 호출(/internal/**, cron·Meta webhook).
 *
 * <p>AuthExchangeController·AuthRefreshController 에 복붙돼 있던 것을 단계 4 에서 끌어올렸다.
 * 그 과정에서 <b>설정값이 비어 있으면 빈 헤더로 통과하던 구멍</b>도 막았다 — 미설정은 곧 잠금이다.
 */
@Component
public class InternalSecret {

  private final byte[] expected;

  public InternalSecret(@Value("${app.internal-secret}") String secret) {
    this.expected = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
  }

  /** 타이밍 공격을 피하려고 상수시간 비교를 쓴다. */
  public void require(String presented) {
    byte[] given = presented == null ? new byte[0] : presented.getBytes(StandardCharsets.UTF_8);
    if (expected.length == 0 || !MessageDigest.isEqual(expected, given)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "내부 호출 자격이 없어요.");
    }
  }
}
