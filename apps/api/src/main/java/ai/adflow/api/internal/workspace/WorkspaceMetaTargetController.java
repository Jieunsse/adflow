package ai.adflow.api.internal.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/internal/workspace-meta-target")
public class WorkspaceMetaTargetController {

  public record TargetPatch(
      String adAccountId,
      String adAccountName,
      String pageId,
      String pageName,
      String pixelId,
      String pixelName,
      String igUserId,
      String igUsername) {}

  public record AuditResponse(
      String actor, String timestamp, JsonNode before, JsonNode after) {}

  private final WorkspaceMetaTargetRepository targetRepository;
  private final WorkspaceMetaTargetAuditRepository auditRepository;
  private final ObjectMapper objectMapper;

  public WorkspaceMetaTargetController(
      WorkspaceMetaTargetRepository targetRepository,
      WorkspaceMetaTargetAuditRepository auditRepository,
      ObjectMapper objectMapper) {
    this.targetRepository = targetRepository;
    this.auditRepository = auditRepository;
    this.objectMapper = objectMapper;
  }

  @GetMapping
  public Map<String, Object> get() {
    Map<String, String> target = targetRepository.findById(WorkspaceMetaTarget.GLOBAL_ID)
        .map(this::toMap).orElseGet(Map::of);
    return Map.of("target", target);
  }

  @GetMapping("/audit")
  public List<AuditResponse> audit() {
    return auditRepository.findAllByOrderByIdAsc().stream()
        .map(a -> new AuditResponse(
            a.getActor(), a.getChangedAt().toString(), a.getBeforeState(), a.getAfterState()))
        .toList();
  }

  @PatchMapping
  @Transactional
  public Map<String, Object> update(
      @RequestParam("actor") String actor, @RequestBody TargetPatch patch) {
    if (actor.isBlank() || patch == null || isEmpty(patch)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "변경할 연결 정보가 없어요.");
    }

    WorkspaceMetaTarget target = targetRepository.findForUpdate(WorkspaceMetaTarget.GLOBAL_ID)
        .orElseGet(() -> {
          WorkspaceMetaTarget created = new WorkspaceMetaTarget();
          created.setId(WorkspaceMetaTarget.GLOBAL_ID);
          return created;
        });
    JsonNode before = objectMapper.valueToTree(toMap(target));
    apply(target, patch);
    targetRepository.save(target);

    WorkspaceMetaTargetAudit audit = new WorkspaceMetaTargetAudit();
    audit.setActor(actor);
    audit.setChangedAt(Instant.now());
    audit.setBeforeState(before);
    audit.setAfterState(objectMapper.valueToTree(toMap(target)));
    auditRepository.save(audit);
    return Map.of("target", toMap(target));
  }

  private boolean isEmpty(TargetPatch p) {
    return p.adAccountId() == null && p.adAccountName() == null && p.pageId() == null
        && p.pageName() == null && p.pixelId() == null && p.pixelName() == null
        && p.igUserId() == null && p.igUsername() == null;
  }

  private void apply(WorkspaceMetaTarget t, TargetPatch p) {
    if (p.adAccountId() != null) t.setAdAccountId(p.adAccountId());
    if (p.adAccountName() != null) t.setAdAccountName(p.adAccountName());
    if (p.pageId() != null) t.setPageId(p.pageId());
    if (p.pageName() != null) t.setPageName(p.pageName());
    if (p.pixelId() != null) t.setPixelId(p.pixelId());
    if (p.pixelName() != null) t.setPixelName(p.pixelName());
    if (p.igUserId() != null) t.setIgUserId(p.igUserId());
    if (p.igUsername() != null) t.setIgUsername(p.igUsername());
  }

  private Map<String, String> toMap(WorkspaceMetaTarget t) {
    Map<String, String> result = new LinkedHashMap<>();
    put(result, "adAccountId", t.getAdAccountId());
    put(result, "adAccountName", t.getAdAccountName());
    put(result, "pageId", t.getPageId());
    put(result, "pageName", t.getPageName());
    put(result, "pixelId", t.getPixelId());
    put(result, "pixelName", t.getPixelName());
    put(result, "igUserId", t.getIgUserId());
    put(result, "igUsername", t.getIgUsername());
    return result;
  }

  private static void put(Map<String, String> result, String key, String value) {
    if (value != null) result.put(key, value);
  }
}
