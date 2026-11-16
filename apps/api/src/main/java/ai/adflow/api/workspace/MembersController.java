package ai.adflow.api.workspace;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.brand.BrandProfileRepository;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 구성원 목록·추가·역할 바꾸기·내보내기 (정책서 5.3). 추가한 사람은 그 이메일로 다음에 로그인할 때 이
 * 워크스페이스에 들어온다.
 *
 * <p>shortcut: 초대 메일·7일 만료 링크 없이 이메일을 미리 등록하는 방식이다. 고객 초대(기능 11)를 만들 때
 * 초대 링크로 바꾼다.
 */
@RestController
@RequestMapping("/workspace/members")
public class MembersController {

  public record MemberView(String email, String role, Instant joinedAt, String brandProfileId) {
    static MemberView of(Member m) {
      return new MemberView(m.getEmail(), m.getRole().displayName(), m.getJoinedAt(), m.getBrandProfileId());
    }
  }

  public record UpsertRequest(String email, String role, String brandProfileId) {}

  private final Workspaces workspaces;
  private final MemberRepository members;
  private final BrandProfileRepository profiles;
  private final Clock clock;

  public MembersController(
      Workspaces workspaces, MemberRepository members, BrandProfileRepository profiles, Clock clock) {
    this.workspaces = workspaces;
    this.profiles = profiles;
    this.members = members;
    this.clock = clock;
  }

  @GetMapping
  public Map<String, List<MemberView>> list(@AuthenticationPrincipal Jwt jwt) {
    String ws = workspaces.idOf(jwt);
    return Map.of(
        "items",
        members.findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(ws).stream()
            .map(MemberView::of)
            .toList());
  }

  /** 새 사람을 넣거나 역할을 바꾼다. 팀장으로 바꾸면 팀장을 넘기는 것이고, 원래 팀장은 팀원·게재가 된다. */
  @PostMapping
  @PreAuthorize("hasRole('LEAD')")
  @Transactional
  public MemberView upsert(@AuthenticationPrincipal Jwt jwt, @RequestBody UpsertRequest body) {
    String email = body.email() == null ? "" : body.email().trim().toLowerCase();
    if (email.isBlank() || !email.contains("@")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일 주소를 확인해 주세요.");
    }
    Role role;
    try {
      role = Role.fromDisplayName(body.role());
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "역할을 골라 주세요.");
    }

    Member me = workspaces.current(jwt.getSubject());
    Member target = members.findById(email).orElse(null);
    boolean inMyWorkspace =
        target != null && !target.isRemoved() && target.getWorkspaceId().equals(me.getWorkspaceId());

    if (target != null && !target.isRemoved() && !inMyWorkspace) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "이미 다른 워크스페이스에 속한 이메일이에요. 다른 이메일로 추가해 주세요.");
    }
    if (email.equals(me.getEmail())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "팀장은 다른 사람에게 팀장을 넘기면 역할이 바뀌어요.");
    }

    String brandId = body.brandProfileId() == null ? "" : body.brandProfileId().trim();
    if (role == Role.CLIENT) {
      if (brandId.isEmpty()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "고객이 볼 브랜드를 골라 주세요.");
      }
      boolean mine =
          profiles.findById(brandId).filter(p -> me.getWorkspaceId().equals(p.getOwnerKey())).isPresent();
      if (!mine) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 워크스페이스의 브랜드만 고를 수 있어요.");
      }
      // 고객사마다 고객 계정은 3명까지다 (기능명세 11).
      long others =
          members.findByWorkspaceIdAndRoleAndBrandProfileIdAndRemovedAtIsNull(me.getWorkspaceId(), Role.CLIENT, brandId).stream()
              .filter(m -> !m.getEmail().equals(email))
              .count();
      if (others >= 3) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "고객사마다 3명까지 등록할 수 있어요. 한 명을 내보낸 뒤 등록해 주세요.");
      }
    }

    if (role == Role.LEAD) {
      if (inMyWorkspace && target.getRole() == Role.CLIENT) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "고객에게는 팀장을 넘길 수 없어요.");
      }
      if (!inMyWorkspace) {
        throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "팀장은 이미 함께 일하는 구성원에게만 넘길 수 있어요.");
      }
      me.setRole(Role.MEMBER_PUBLISH);
      members.save(me);
    }

    Member saved =
        inMyWorkspace ? target : new Member(email, me.getWorkspaceId(), role, clock.instant());
    saved.setRole(role);
    saved.setBrandProfileId(role == Role.CLIENT ? brandId : null);
    return MemberView.of(members.save(saved));
  }

  @DeleteMapping
  @PreAuthorize("hasRole('LEAD')")
  @Transactional
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("email") String email) {
    Member me = workspaces.current(jwt.getSubject());
    Member target =
        members
            .findById(email.trim().toLowerCase())
            .filter(m -> !m.isRemoved() && m.getWorkspaceId().equals(me.getWorkspaceId()))
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "이 워크스페이스에 없는 사람이에요."));
    if (target.getEmail().equals(me.getEmail())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "팀장은 다른 사람에게 팀장을 넘긴 뒤에 나갈 수 있어요.");
    }
    target.setRemovedAt(clock.instant());
    members.save(target);
    return Map.of("ok", true);
  }
}
