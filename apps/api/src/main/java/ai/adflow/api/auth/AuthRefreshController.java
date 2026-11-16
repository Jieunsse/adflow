package ai.adflow.api.auth;

import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import ai.adflow.api.workspace.Workspaces;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
  private final Workspaces workspaces;

  public AuthRefreshController(
      @Qualifier("refreshJwtDecoder") JwtDecoder refreshJwtDecoder,
      TokenIssuer tokenIssuer,
      Workspaces workspaces) {
    this.refreshJwtDecoder = refreshJwtDecoder;
    this.tokenIssuer = tokenIssuer;
    this.workspaces = workspaces;
  }

  @PostMapping("/refresh")
  public ResponseEntity<ExchangeResponse> refresh(
      @Valid @RequestBody RefreshRequest request) {

    Jwt jwt;
    try {
      jwt = refreshJwtDecoder.decode(request.refreshToken());
    } catch (JwtException e) {
      throw new ResponseStatusException(
          HttpStatus.UNAUTHORIZED, "갱신 토큰이 유효하지 않아요. 다시 로그인해 주세요.");
    }

    String email = jwt.getClaimAsString("email");
    // 내보낸 사람은 여기서 403 이 나 갱신되지 않는다.
    Role role = workspaces.current(jwt.getSubject()).getRole();

    TokenIssuer.Issued issued = tokenIssuer.issue(jwt.getSubject(), email, role);
    return ResponseEntity.ok(
        new ExchangeResponse(
            issued.token(),
            issued.expiresAt(),
            issued.refreshToken(),
            issued.refreshExpiresAt(),
            role.displayName()));
  }

}
