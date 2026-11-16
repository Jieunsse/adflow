package ai.adflow.api.internal.cron;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CronRunRepository extends JpaRepository<CronRun, Long> {

  /** health 라우트(2겹)가 dead-man's switch 를 걸 때 보는 한 행. */
  Optional<CronRun> findFirstByJobAndOkTrueOrderByFinishedAtDesc(String job);
}
