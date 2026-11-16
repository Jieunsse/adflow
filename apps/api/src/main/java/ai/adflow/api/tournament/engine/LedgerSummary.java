package ai.adflow.api.tournament.engine;

import java.util.List;
import java.util.Set;

/** Ledger 요약. TS: LedgerSummary. tested = confirmed ∪ refuted ∪ inconclusive. */
public record LedgerSummary(
    Set<String> confirmed, Set<String> refuted, Set<String> tested, List<Hypothesis> relevant) {}
