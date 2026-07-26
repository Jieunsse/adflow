package ai.adflow.api.auth;

import ai.adflow.api.connection.MetaConnection;
import ai.adflow.api.connection.MetaConnectionRepository;
import ai.adflow.api.internal.InternalSecret;
import ai.adflow.api.security.Role;
import ai.adflow.api.security.TokenIssuer;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 로그인은 NextAuth 가 한다(Meta OAuth 토큰이 거기서만 나온다). 이 엔드포인트는 그 결과를 받아 Meta
 * 연결을 영속하고 우리 JWT 를 발급한다.
 *
 * <p>JWT 가 없는 상태에서 호출되므로 리소스 서버 인증 대신 내부 시크릿으로 지킨다.
 */
@RestController
@RequestMapping("/auth")
public class AuthExchangeController {

  /** 영속 제외 sentinel — 둘러보기 게스트는 백엔드를 쓰지 않는다 (ADR-033). */
  private static final String GUEST_OWNER = "guest@adflow.local";

  private final MetaConnectionRepository repository;
  private final TokenIssuer tokenIssuer;
  private final InternalSecret internalSecret;

  public AuthExchangeController(
      MetaConnectionRepository repository,
      TokenIssuer tokenIssuer,
      InternalSecret internalSecret) {
    this.repository = repository;
    this.tokenIssuer = tokenIssuer;
    this.internalSecret = internalSecret;
  }

  @PostMapping("/exchange")
  public ResponseEntity<ExchangeResponse> exchange(
      @RequestHeader(value = "X-Internal-Secret", required = false) String presented,
      @Valid @RequestBody ExchangeRequest request) {

    internalSecret.require(presented);

    if (GUEST_OWNER.equals(request.ownerKey()) || GUEST_OWNER.equals(request.email())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "둘러보기 게스트는 토큰을 발급받지 않아요.");
    }

    Role role = request.role() == null ? Role.LEAD : Role.fromDisplayName(request.role());
    persist(request, role);

    TokenIssuer.Issued issued = tokenIssuer.issue(request.ownerKey(), request.email(), role);
    return ResponseEntity.ok(
        new ExchangeResponse(
            issued.token(), issued.expiresAt(), issued.refreshToken(), issued.refreshExpiresAt()));
  }


  private void persist(ExchangeRequest request, Role role) {
    MetaConnection entity = repository.findById(request.ownerKey()).orElseGet(MetaConnection::new);
    entity.setOwnerKey(request.ownerKey());
    entity.setEmail(request.email());
    entity.setRole(role);
    entity.setUpdatedAt(Instant.now());

    ExchangeRequest.MetaConnectionPayload meta = request.metaConnection();
    if (meta != null) {
      entity.setAccessToken(meta.accessToken());
      entity.setIgAccessToken(meta.igAccessToken());
      entity.setAdAccountId(meta.adAccountId());
      entity.setAdAccountName(meta.adAccountName());
      entity.setPageId(meta.pageId());
      entity.setPageName(meta.pageName());
      entity.setPixelId(meta.pixelId());
      entity.setPixelName(meta.pixelName());
      entity.setIgUserId(meta.igUserId());
      entity.setIgUsername(meta.igUsername());
    }
    repository.save(entity);
  }
}
