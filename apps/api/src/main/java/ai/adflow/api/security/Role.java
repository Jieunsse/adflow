package ai.adflow.api.security;

import java.util.Arrays;

/**
 * 도메인 역할 ↔ Spring authority 매핑의 단일 소스.
 *
 * <p>화면·도메인 어휘는 한글(팀장/팀원·게재/팀원·검토)이지만 JWT 클레임과 authority 는 ASCII 를 쓴다.
 * 한글을 authority 로 쓰면 hasRole 매칭·로그·디버깅에서 인코딩 함정이 생긴다.
 */
public enum Role {
  LEAD("팀장"),
  MEMBER_PUBLISH("팀원·게재"),
  MEMBER_REVIEW("팀원·검토");

  private final String displayName;

  Role(String displayName) {
    this.displayName = displayName;
  }

  public String authority() {
    return name();
  }

  public String displayName() {
    return displayName;
  }

  public static Role fromDisplayName(String value) {
    return Arrays.stream(values())
        .filter(r -> r.displayName.equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 역할이에요: " + value));
  }

  public static Role fromAuthority(String value) {
    return Arrays.stream(values())
        .filter(r -> r.name().equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("알 수 없는 authority 예요: " + value));
  }
}
