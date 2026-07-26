package ai.adflow.api.store.onboarding;

import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 온보딩 완료 표시. 소유자당 0 또는 1행이라 컬렉션 계약(items)이 아니다. */
@RestController
@RequestMapping("/stores/onboarding")
public class OnboardingController {

  private final OnboardedUserRepository repository;

  public OnboardingController(OnboardedUserRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public Map<String, Boolean> status(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("onboarded", repository.existsById(jwt.getSubject()));
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> complete(@AuthenticationPrincipal Jwt jwt) {
    // PK 가 ownerKey 라 save 가 곧 upsert 다 — 두 번 눌러도 안전하다.
    OnboardedUser user = new OnboardedUser();
    user.setOwnerKey(jwt.getSubject());
    user.setOnboardedAt(Instant.now());
    repository.save(user);
    return Map.of("ok", true);
  }

  @DeleteMapping
  @Transactional
  public Map<String, Boolean> reset(@AuthenticationPrincipal Jwt jwt) {
    repository.deleteById(jwt.getSubject());
    return Map.of("ok", true);
  }
}
