"use client";

// 디테일 모드 전용 — 5개 큐레이션 노브를 한 곳에. PRD §5.4.2.
//   (1) 입찰 전략 — 최저 비용 / 대상 비용 / 목표 단가 + (cap 일 때) bidAmount 인풋
//   (2) 맞춤 타겟 + 유사(lookalike) — 현재 UI만 (Phase 1 결정)
//   (3) 광고 플랫폼 + 세부 위치 — 플랫폼 좁히면 위치도 자동 정리, 충돌 가드
//   (4) 자동 되돌림 guardrail — UI만 (곧 연동)
//   (5) A/B 소재 시험 — UI만 (곧 연동)

import Icon from "@shared/ui/Icon";
import { Badge } from "@shared/ui/primitives";
import { useToast } from "@shared/ui/Toast";
import { useLaunchDraft } from "@entities/campaign/model";
import SubHead from "./SubHead";

export default function DetailKnobs() {
  const showToast = useToast();
  const { state, dispatch } = useLaunchDraft();

  return (
    <>
      {/* (1) 입찰 전략 */}
      <SubHead title="입찰 전략" subtitle="AI: 첫 캠페인엔 '최저 비용'이 안전해요. 노출이 빠르게 시작돼요." />
      <div className="chips" style={{ marginBottom: 8 }}>
        {[
          { id: "LOWEST_COST_WITHOUT_CAP" as const, label: "최저 비용" },
          { id: "LOWEST_COST_WITH_BID_CAP" as const, label: "대상 비용" },
          { id: "COST_CAP" as const, label: "목표 단가" },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            className={"chip" + (state.bidStrategy === b.id ? " chip--on" : "")}
            onClick={() => dispatch({ type: "SET_BID_STRATEGY", strategy: b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      {state.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
        <div className="input--addon" style={{ marginBottom: 12, maxWidth: 240 }}>
          <span className="addon">₩</span>
          <input
            inputMode="numeric"
            placeholder={state.bidStrategy === "LOWEST_COST_WITH_BID_CAP" ? "입찰 상한 (KRW)" : "목표 단가 (KRW)"}
            value={state.bidAmount?.toLocaleString("ko-KR") ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
              dispatch({ type: "SET_BID_AMOUNT", amount: Number.isFinite(n) ? n : null });
            }}
            aria-label="입찰 금액"
          />
        </div>
      )}

      <hr className="divider" />

      {/* (2) 맞춤 타겟 + 유사 타겟 — 모두 UI만 (Phase 1) */}
      <SubHead title="맞춤 타겟 + 유사 타겟" subtitle="기존에 만든 맞춤 타겟을 선택하거나 유사 타겟을 자동 생성해요." />
      <select
        className="select"
        value=""
        onChange={() => {}}
        disabled
        style={{ marginBottom: 8 }}
        aria-label="맞춤 타겟"
      >
        <option value="">맞춤 타겟이 아직 없어요 — Meta 광고 관리자에서 만들어주세요</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={state.lookalikeEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_LOOKALIKE_ENABLED", enabled: e.target.checked });
            if (e.target.checked) showToast("유사 타겟 자동 생성은 곧 적용돼요");
          }}
        />
        <span style={{ font: "500 13px/1.4 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
          유사 타겟(lookalike) 자동 생성
        </span>
        <Badge kind="neutral">곧 연동</Badge>
      </label>

      <hr className="divider" />

      {/* (3) 광고 플랫폼 + 세부 위치 */}
      <SubHead title="광고 플랫폼" subtitle="페이스북·인스타그램 중 어디에 노출할지 고르고, 필요하면 아래에서 세부 위치까지 정해요." />
      <div className="chips" style={{ marginBottom: 14 }}>
        {([
          { id: "both" as const, label: "페이스북 · 인스타그램" },
          { id: "facebook" as const, label: "페이스북만" },
          { id: "instagram" as const, label: "인스타그램만" },
        ]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={"chip" + (state.platforms === opt.id ? " chip--on" : "")}
            onClick={() => {
              dispatch({ type: "SET_PLATFORMS", platforms: opt.id });
              // 플랫폼이 좁아지면 수동 위치 중 그 플랫폼 외 항목은 자동 정리
              if (state.placements.mode === "manual") {
                const allowed = opt.id === "facebook" ? ["facebook_feed"]
                  : opt.id === "instagram" ? ["instagram_feed", "instagram_stories"]
                  : ["facebook_feed", "instagram_feed", "instagram_stories", "audience_network", "messenger"];
                const filtered = state.placements.positions.filter((p) => allowed.includes(p));
                if (filtered.length !== state.placements.positions.length) {
                  dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: filtered } });
                }
              }
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SubHead title="세부 위치" subtitle="자동을 권해요. 보통 자동이 CPM이 더 낮아요." />
      <div className="seg" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={state.placements.mode === "auto" ? "on" : ""}
          onClick={() => dispatch({ type: "SET_PLACEMENTS", placements: { mode: "auto" } })}
        >
          자동 (Advantage+)
        </button>
        <button
          type="button"
          className={state.placements.mode === "manual" ? "on" : ""}
          onClick={() => {
            const defaults = state.platforms === "facebook" ? ["facebook_feed"]
              : state.platforms === "instagram" ? ["instagram_feed"]
              : ["facebook_feed", "instagram_feed"];
            const seed = state.placements.mode === "manual" ? state.placements.positions : defaults;
            dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: seed } });
          }}
        >
          수동
        </button>
      </div>
      {state.placements.mode === "manual" && (
        <div className="chips" style={{ marginBottom: 4 }}>
          {[
            { id: "facebook_feed", label: "Facebook 피드", platform: "facebook" as const },
            { id: "instagram_feed", label: "Instagram 피드", platform: "instagram" as const },
            { id: "instagram_stories", label: "Instagram 스토리", platform: "instagram" as const },
            { id: "audience_network", label: "Audience Network", platform: "both" as const },
            { id: "messenger", label: "Messenger", platform: "both" as const },
          ].map((pos) => {
            const positions = state.placements.mode === "manual" ? state.placements.positions : [];
            const on = positions.includes(pos.id);
            // 플랫폼 picker 와 충돌하는 위치는 비활성
            const allowedByPlatform =
              state.platforms === "both" ||
              pos.platform === "both" ||
              pos.platform === state.platforms;
            return (
              <button
                key={pos.id}
                type="button"
                className={"chip" + (on ? " chip--on" : "")}
                disabled={!allowedByPlatform}
                style={{ opacity: allowedByPlatform ? 1 : 0.45 }}
                title={!allowedByPlatform ? "광고 플랫폼에서 해당 채널을 먼저 선택해 주세요" : undefined}
                onClick={() => {
                  const next = on ? positions.filter((x) => x !== pos.id) : [...positions, pos.id];
                  dispatch({ type: "SET_PLACEMENTS", placements: { mode: "manual", positions: next } });
                }}
              >
                {pos.label}
              </button>
            );
          })}
        </div>
      )}

      <hr className="divider" />

      {/* (4) 자동 되돌림 guardrail — UI만 */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <input
          type="checkbox"
          style={{ marginTop: 3 }}
          checked={state.autoPauseGuardrailEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_AUTO_PAUSE_GUARDRAIL", enabled: e.target.checked });
            if (e.target.checked) showToast("자동 광고중단은 곧 연동돼요");
          }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            성과 기준 미달 시 자동 광고중단 <Badge kind="neutral">곧 연동</Badge>
          </div>
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "3px 0 0" }}>
            첫 3일 동안 CPM이 광고 계정 평균 대비 2배 넘으면 자동으로 일시정지해요.
          </p>
        </div>
      </label>

      {/* (5) A/B 소재 시험 — UI만 */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <input
          type="checkbox"
          style={{ marginTop: 3 }}
          checked={state.abTestEnabled}
          onChange={(e) => {
            dispatch({ type: "SET_AB_TEST_ENABLED", enabled: e.target.checked });
            if (e.target.checked) showToast("두 개 소재 시험은 곧 연동돼요");
          }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "600 13.5px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>
            헤드라인 두 개로 A/B 시험 <Badge kind="neutral">곧 연동</Badge>
          </div>
          <p style={{ font: "400 13px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", margin: "3px 0 0" }}>
            STEP 01에서 만든 헤드라인 중 2개를 같은 광고세트에 두 광고로 등록해요. 7일 후 우세한 쪽 안내.
          </p>
        </div>
      </label>
    </>
  );
}
