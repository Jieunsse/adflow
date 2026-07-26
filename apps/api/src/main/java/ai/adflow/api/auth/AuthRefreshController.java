package ai.adflow.api.auth;

import ai.adflow.api.security.JwtConfig;
import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 무상태 갱신 — 서버는 발급한 refresh 토큰을 기억하지 않는다(테이블 없음).
 *
 * 개별 토큰 회수가 필요해지면 서명키를 바꾸는 것이 유일한 무효화 수단이다. 보유 주체가
 * 브라우저가 아니라 Next.js 서버라 탈취 면이 좁아 이 절충을 택했다.
 */
@RestController
@RequestMapping("/auth")
public class AuthRefreshController {

  private final JwtDecoder refreshJwtDecoder;
  private final TokenIssuer tokenIssuer;
  private final byte[] internalSecret;

  public AuthRefreshController(
      @Qualifier("refreshJwtDecoder") JwtDecoder refreshJwtDecoder,
      TokenIssuer tokenIssuer,
      @Value("${app.internal-secret}") String internalSecret) {
    this.refreshJwtDecoder = refreshJwtDecoder;
    this.tokenIssuer = tokenIssuer;
    this.internalSecret = internalSecret.getBytes(StandardCharsets.UTF_8);
  }

  @PostMapping("/refresh")
  public ResponseEntity<ExchangeResponse> refresh(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @Valid @RequestBody RefreshRequest request) {

    requireInternalSecret(presented);

    Jwt jwt;
    try {
      jwt = refreshJwtDecoder.decode(request.refreshToken());
    } catch (JwtException e) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "갱신 토큰이 유효하지 않아요. 다시 로그인해 주세요.");
    }

    List<String> roles = jwt.getClaimAsStringList(JwtConfig.ROLES_CLAIM);
    Role role = roles == null || roles.isEmpty() ? Role.LEAD : Role.fromAuthority(roles.get(0));
    String email = jwt.getClaimAsString("email");

    TokenIssuer.Issued issued = tokenIssuer.issue(jwt.getSubject(), email, role);
    return ResponseEntity.ok(
        new ExchangeResponse(
            issued.token(), issued.expiresAt(), issued.refreshToken(), issued.refreshExpiresAt()));
  }

  /** 타이밍 공격을 피하려고 상수시간 비교를 쓴다. */
  private void requireInternalSecret(String presented) {
    if (presented == null
        || !MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), internalSecret)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "내부 호출 자격이 없어요.");
    }
  }
}
