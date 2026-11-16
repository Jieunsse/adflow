package ai.adflow.api.internal.cron;

import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ADR-042 폴러 자기기록.
 *
 * <p>cron 은 세션 없이 돌아 JWT 를 못 싣는다 — 내부 시크릿으로 지킨다(SecurityConfig 가 /internal/**
 * 전체에 요구한다).
 */
@RestController
@RequestMapping("/internal/cron-runs")
public class CronRunController {

  private final CronRunRepository repository;

  public CronRunController(CronRunRepository repository) {
    this.repository = repository;
  }

  @PostMapping
  @Transactional
  public Map<String, Boolean> record(@RequestBody CronRun run) {
    // 종료 시각은 서버가 찍는다 — 호출자가 보내는 값이 아니다.
    run.setFinishedAt(Instant.now().toString());
    repository.save(run);
    return Map.of("ok", true);
  }

  @GetMapping("/last-success")
  public ResponseEntity<CronRun> lastSuccess(@RequestParam("job") String job) {
    return repository
        .findFirstByJobAndOkTrueOrderByFinishedAtDesc(job)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }
}
