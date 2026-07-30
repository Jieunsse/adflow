package ai.adflow.api.internal;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Next.js 서버만 아는 값. JWT 로 지킬 수 없는 경로가 쓴다 — 토큰 발급 이전 단계(/auth/**)와
 * 세션 없는 기계 호출(/internal/**, cron·Meta webhook).
 *
 * <p>AuthExchangeController·AuthRefreshController 에 복붙돼 있던 것을 단계 4 에서 끌어올렸다.
 * 그 과정에서 <b>설정값이 비어 있으면 빈 헤더로 통과하던 구멍</b>도 막았다 — 미설정은 곧 잠금이다.
 *
 * <p>강제는 {@link ai.adflow.api.security.SecurityConfig} 의 필터 체인이 한다. 컨트롤러마다 손으로
 * 부르던 시절엔 새 컨트롤러가 한 줄 빼먹으면 조용히 열렸다 — 지켜야 할 곳이 7곳에서 1곳이 됐다.
 */
@Component
public class InternalSecret {

  /** 호출자가 시크릿을 싣는 헤더. */
  public static final String HEADER = "X-Internal-Secret";

  /** 시크릿을 요구하는 경로. 잠그는 쪽(SecurityConfig)과 문서(OpenApiConfig)가 같은 목록을 본다. */
  public static final String[] PATTERNS = {"/auth/exchange", "/auth/refresh", "/internal/**"};

  private final byte[] expected;

  public InternalSecret(@Value("${app.internal-secret}") String secret) {
    this.expected = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
  }

  /** 타이밍 공격을 피하려고 상수시간 비교를 쓴다. */
  public boolean matches(String presented) {
    byte[] given = presented == null ? new byte[0] : presented.getBytes(StandardCharsets.UTF_8);
    return expected.length > 0 && MessageDigest.isEqual(expected, given);
  }
}
