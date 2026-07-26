package ai.adflow.api.me;

import ai.adflow.api.connection.MetaConnectionRepository;
import ai.adflow.api.security.Role;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/me")
public class MeController {

  private final MetaConnectionRepository repository;

  public MeController(MetaConnectionRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public Map<String, String> me(@AuthenticationPrincipal Jwt jwt) {
    List<String> roles = jwt.getClaimAsStringList("roles");
    String authority = (roles == null || roles.isEmpty()) ? Role.LEAD.authority() : roles.get(0);
    String email = jwt.getClaimAsString("email");
    return Map.of(
        "ownerKey", jwt.getSubject(),
        "email", email == null ? "" : email,
        "role", Role.fromAuthority(authority).displayName());
  }

  /** 자격증명 교체·삭제는 팀장만 (설계 §4 인가). */
  @DeleteMapping("/meta-connection")
  @PreAuthorize("hasRole('LEAD')")
  public ResponseEntity<Void> deleteConnection(@AuthenticationPrincipal Jwt jwt) {
    repository.deleteById(jwt.getSubject());
    return ResponseEntity.noContent().build();
  }
}
