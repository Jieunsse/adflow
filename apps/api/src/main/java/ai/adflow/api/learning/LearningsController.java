package ai.adflow.api.learning;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.ItemsResponse;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 배운 것 목록·문장 고치기·확정·보관 (기능 4, 정책서 14.2). 지우는 길은 없다. */
@RestController
@RequestMapping("/learnings")
public class LearningsController {

  public record SentenceRequest(String sentence) {}

  public record ArchiveRequest(String reason) {}

  private static final int MAX_SENTENCE = 200;

  private final LearningRepository repository;
  private final Workspaces workspaces;
  private final Clock clock;

  public LearningsController(LearningRepository repository, Workspaces workspaces, Clock clock) {
    this.repository = repository;
    this.workspaces = workspaces;
    this.clock = clock;
  }

  @GetMapping
  public ItemsResponse<Learning> list(
      @AuthenticationPrincipal Jwt jwt, @RequestParam("brandProfileId") String brandProfileId) {
    return new ItemsResponse<>(
        repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(workspaces.idOf(jwt), brandProfileId));
  }

  /** 문장은 확정 전후 모두 고칠 수 있다. 숫자와 결과는 고칠 수 없다. */
  @PutMapping("/{id}/sentence")
  @Transactional
  public Learning editSentence(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody SentenceRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    Learning l = load(me, id);
    String s = body.sentence() == null ? "" : body.sentence().trim();
    if (s.isEmpty() || s.length() > MAX_SENTENCE) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "문장은 1자 이상 200자 이하로 적어 주세요.");
    }
    l.setSentence(s);
    l.setSentenceEditedBy(me.getEmail());
    l.setSentenceEditedAt(clock.instant().toString());
    l.setUpdatedAt(clock.instant());
    return repository.save(l);
  }

  /** 초안과 보관한 기록을 확정한다. 확정은 팀장과 팀원·게재만 (14.2). */
  @PostMapping("/{id}/confirm")
  @Transactional
  public Learning confirm(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    Member me = requireDecider(jwt);
    Learning l = load(me, id);
    l.setStatus(Learnings.CONFIRMED);
    l.setArchiveReason(null);
    l.setDecidedBy(me.getEmail());
    l.setDecidedAt(clock.instant().toString());
    l.setUpdatedAt(clock.instant());
    return repository.save(l);
  }

  @PostMapping("/{id}/archive")
  @Transactional
  public Learning archive(
      @AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody ArchiveRequest body) {
    Member me = requireDecider(jwt);
    Learning l = load(me, id);
    if (body.reason() == null || body.reason().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "보관하는 이유를 적어 주세요.");
    }
    l.setStatus(Learnings.ARCHIVED);
    l.setArchiveReason(body.reason().trim());
    l.setDecidedBy(me.getEmail());
    l.setDecidedAt(clock.instant().toString());
    l.setUpdatedAt(clock.instant());
    return repository.save(l);
  }

  private Member requireDecider(Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getRole() != Role.LEAD && me.getRole() != Role.MEMBER_PUBLISH) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "확정과 보관은 팀장과 팀원·게재만 할 수 있어요. 팀장에게 요청해 주세요.");
    }
    return me;
  }

  private Learning load(Member me, String id) {
    return repository
        .findById(id)
        .filter(l -> me.getWorkspaceId().equals(l.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록을 찾지 못했어요."));
  }
}
