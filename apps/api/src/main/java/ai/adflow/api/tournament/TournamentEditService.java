package ai.adflow.api.tournament;

import ai.adflow.api.tournament.engine.TourEngine;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 사람이 누르는 편집 — 챔피언 확정·수동 챌린저·봉투 충전·복구·종료. TS: server-runner.ts 의 같은 이름들.
 *
 * <p><b>왜 옮겼나.</b> 이 편집들은 Next 가 애그리거트를 통째로 다시 저장하는 경로였다. upsert 는
 * 지우고 새로 넣으므로 {@code @Version} 비교를 지나간다 — 사람이 버튼을 누르는 순간과 폴러 틱이
 * 겹치면 앞선 변경이 조용히 사라진다. 폴러가 무인으로 돌기 시작한 뒤로 그 창이 실제로 열렸다.
 *
 * <p>여기서는 managed 엔티티를 읽어 필요한 필드만 고친다. 겹치면 낙관적 락이 잡는다.
 */
@Service
public class TournamentEditService {

  /** 챌린저 카피는 Gemini 가 만든다(Next). 여기 오는 것은 그 결과다. */
  public record Variant(String headline, String primaryText, String imageUrl) {}

  private final TournamentRepository repository;

  public TournamentEditService(TournamentRepository repository) {
    this.repository = repository;
  }

  @Transactional
  public Tournament confirmChampion(String id, Variant edited) {
    Tournament t = load(id);
    if (edited != null) t.setChampion(entity(edited));
    t.setChampionConfirmed(true);
    return repository.save(t);
  }

  /** AI 부트스트랩 재생성 — 확정 전에만. 확정된 챔피언을 되돌리는 문이 아니다. */
  @Transactional
  public Tournament replaceChampion(String id, Variant champion) {
    Tournament t = load(id);
    if (Boolean.TRUE.equals(t.getChampionConfirmed())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 확정된 챔피언이에요.");
    }
    t.setChampion(entity(champion));
    return repository.save(t);
  }

  @Transactional
  public Tournament setChallenger(String id, Variant challenger) {
    Tournament t = load(id);
    t.setPendingChallenger(entity(challenger));
    return repository.save(t);
  }

  @Transactional
  public Tournament refillEnvelope(String id, Double addBudget) {
    Tournament t = load(id);
    double add = addBudget == null ? 300000 : addBudget;

    Tournament.Envelope env = t.getEnvelope();
    if (env == null) {
      env = new Tournament.Envelope();
      t.setEnvelope(env);
    }
    double base = env.getTotalBudget() == null ? nz(t.getSpentBudget()) : env.getTotalBudget();
    env.setTotalBudget(base + add);
    return repository.save(t);
  }

  /** ADR-053 복구 — lastError 만 지우면 다음 폴에서 자동 진행이 다시 붙는다. */
  @Transactional
  public Tournament resume(String id) {
    Tournament t = load(id);
    if (t.getLastError() == null) return t;
    t.setLastError(null);
    return repository.save(t);
  }

  @Transactional
  public Tournament end(String id) {
    Tournament t = load(id);
    t.setStatus("completed");
    t.setCompletionReason(TourEngine.endCompletionReason(TourStates.of(t))); // ADR-061
    t.setPendingChallenger(null);
    return repository.save(t);
  }

  private Tournament load(String id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "토너먼트를 찾을 수 없어요."));
  }

  private static Tournament.Variant entity(Variant v) {
    if (v == null) return null;
    Tournament.Variant out = new Tournament.Variant();
    out.setHeadline(v.headline());
    out.setPrimaryText(v.primaryText());
    out.setImageUrl(v.imageUrl());
    return out;
  }

  private static double nz(Double v) {
    return v == null ? 0 : v;
  }
}
