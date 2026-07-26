package ai.adflow.api.tournament.engine;

/** Ledger 필터 맥락. TS: LedgerContext. personaId 는 optional. */
public record LedgerContext(String productId, String personaId, String objective) {}
