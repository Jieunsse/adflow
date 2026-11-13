package ai.adflow.api.brand;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.ItemsResponse;
import ai.adflow.api.store.brand.BrandProfile;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 브랜드마다 광고 계정 1개와 담당 직원 1명 (기능 10, 정책서 4.0·5.1).
 *
 * <p>광고 계정에 접근할 수 있는지는 여기서 확인하지 않는다. 서버에는 직원의 Meta 토큰이 없어서, 웹이
 * 저장 전에 그 직원의 토큰으로 확인한다.
 */
@RestController
@RequestMapping("/brands")
public class BrandsController {

  public record ConnectionRequest(
      String adAccountId,
      String adAccountName,
      String pageId,
      String pageName,
      String pixelId,
      String pixelName,
      String igUserId,
      String igUsername) {}

  public record ManagerRequest(String email) {}

  private final BrandConnectionRepository connections;
  private final BrandProfileRepository profiles;
  private final MemberRepository members;
  private final Workspaces workspaces;
  private final Clock clock;

  public BrandsController(
      BrandConnectionRepository connections,
      BrandProfileRepository profiles,
      MemberRepository members,
      Workspaces workspaces,
      Clock clock) {
    this.connections = connections;
    this.profiles = profiles;
    this.members = members;
    this.workspaces = workspaces;
    this.clock = clock;
  }

  @GetMapping
  public ItemsResponse<BrandConnection> list(@AuthenticationPrincipal Jwt jwt) {
    return new ItemsResponse<>(connections.findByOwnerKeyOrderByUpdatedAtDesc(workspaces.idOf(jwt)));
  }

  @GetMapping("/{brandId}")
  public ResponseEntity<BrandConnection> get(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String brandId) {
    String ws = workspaces.idOf(jwt);
    return connections
        .findById(brandId)
        .filter(c -> ws.equals(c.getOwnerKey()))
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }

  /** 담당 직원이 고른다. 담당이 아직 없으면 팀장만 고를 수 있다. */
  @PutMapping("/{brandId}/connection")
  @Transactional
  public BrandConnection connect(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String brandId,
      @RequestBody ConnectionRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    BrandConnection c = loadOrNew(me, brandId);
    if (me.getRole() != Role.LEAD && !me.getEmail().equals(c.getManagerEmail())) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "이 브랜드의 담당 직원과 팀장만 광고 계정을 연결할 수 있어요.");
    }
    if (isBlank(body.adAccountId()) || isBlank(body.pageId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "광고 계정과 페이지를 모두 골라 주세요.");
    }

    connections
        .findByAdAccountId(body.adAccountId())
        .filter(other -> !other.getId().equals(brandId))
        .ifPresent(
            other -> {
              // 브랜드 프로필을 지우면 연결 행만 남는다. 그런 행이 계정을 계속 붙잡지 않게 치운다.
              if (!profiles.existsById(other.getId())) {
                connections.delete(other);
                connections.flush();
                return;
              }
              throw new ResponseStatusException(
                  HttpStatus.CONFLICT,
                  "이 광고 계정은 이미 '" + brandName(other.getId()) + "' 브랜드에 연결돼 있어요.");
            });

    c.setAdAccountId(body.adAccountId());
    c.setAdAccountName(body.adAccountName());
    c.setPageId(body.pageId());
    c.setPageName(body.pageName());
    c.setPixelId(body.pixelId());
    c.setPixelName(body.pixelName());
    c.setIgUserId(body.igUserId());
    c.setIgUsername(body.igUsername());
    c.setUpdatedAt(clock.instant());
    return connections.save(c);
  }

  /** 연결 끊기는 팀장만 (정책서 4.2). 담당 직원은 남긴다. */
  @DeleteMapping("/{brandId}/connection")
  @Transactional
  public BrandConnection disconnect(@AuthenticationPrincipal Jwt jwt, @PathVariable String brandId) {
    Member me = requireLead(jwt);
    BrandConnection c = loadOrNew(me, brandId);
    c.setAdAccountId(null);
    c.setAdAccountName(null);
    c.setPageId(null);
    c.setPageName(null);
    c.setPixelId(null);
    c.setPixelName(null);
    c.setIgUserId(null);
    c.setIgUsername(null);
    c.setUpdatedAt(clock.instant());
    return connections.save(c);
  }

  /** 담당 직원 정하기는 팀장만 (정책서 5.2). */
  @PutMapping("/{brandId}/manager")
  @Transactional
  public BrandConnection assignManager(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String brandId,
      @RequestBody ManagerRequest body) {
    Member me = requireLead(jwt);
    String email = body.email() == null ? "" : body.email().trim().toLowerCase();
    members
        .findById(email)
        .filter(m -> !m.isRemoved() && m.getWorkspaceId().equals(me.getWorkspaceId()))
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "이 워크스페이스의 구성원만 담당으로 정할 수 있어요."));
    BrandConnection c = loadOrNew(me, brandId);
    c.setManagerEmail(email);
    c.setUpdatedAt(clock.instant());
    return connections.save(c);
  }

  private Member requireLead(Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getRole() != Role.LEAD) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "이 일은 팀장만 할 수 있어요. 팀장에게 요청해 주세요.");
    }
    return me;
  }

  /** 내 워크스페이스의 브랜드여야 한다. 연결이 아직 없으면 새로 만든다. */
  private BrandConnection loadOrNew(Member me, String brandId) {
    profiles
        .findById(brandId)
        .filter(p -> me.getWorkspaceId().equals(p.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "브랜드를 찾지 못했어요."));
    return connections
        .findById(brandId)
        .orElseGet(
            () -> {
              BrandConnection c = new BrandConnection();
              c.setId(brandId);
              c.setOwnerKey(me.getWorkspaceId());
              return c;
            });
  }

  private String brandName(String brandId) {
    return profiles.findById(brandId).map(BrandProfile::getName).orElse("다른");
  }

  private static boolean isBlank(String s) {
    return s == null || s.isBlank();
  }
}
