export type AdEffectiveStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "WITH_ISSUES"
  | "DISAPPROVED"
  | "PAUSED";

export interface AdSnapshot {
  adId: string;
  campaignId: string;
  name: string;
  status: AdEffectiveStatus;
  issueReason: string | null;
}

export interface AdStatusEmission {
  adId: string;
  campaignId: string;
  message: string;
  transition: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function adName(s: string): string {
  return truncate(s.trim() || "광고", 40);
}

function reasonText(r: string | null): string {
  if (!r || !r.trim()) return "Ads Manager 에서 사유 확인";
  return truncate(r.trim(), 80);
}

function transitionMessage(
  from: AdEffectiveStatus,
  to: AdEffectiveStatus,
  name: string,
  reason: string | null,
): string | null {
  const n = adName(name);
  const r = reasonText(reason);
  if (from === "PENDING_REVIEW" && to === "ACTIVE") return `**${n}** 광고가 승인됐어요`;
  if (from === "PENDING_REVIEW" && to === "DISAPPROVED") return `**${n}** 광고가 거부됐어요 — ${r}`;
  if (from === "PENDING_REVIEW" && to === "WITH_ISSUES") return `**${n}** 광고에 이슈가 발견됐어요`;
  if (from === "ACTIVE" && to === "DISAPPROVED") return `**${n}** 광고가 거부됐어요 — ${r}`;
  if (from === "ACTIVE" && to === "WITH_ISSUES") return `**${n}** 광고에 이슈가 발견됐어요 — ${r}`;
  if (from === "WITH_ISSUES" && to === "ACTIVE") return `**${n}** 광고 이슈가 해결됐어요`;
  if (from === "WITH_ISSUES" && to === "DISAPPROVED") return `**${n}** 광고가 거부됐어요 — ${r}`;
  if (from === "DISAPPROVED" && to === "ACTIVE") return `**${n}** 광고 어필이 통과됐어요`;
  return null;
}

export function diffSnapshots(
  prev: Map<string, AdEffectiveStatus>,
  next: AdSnapshot[],
): AdStatusEmission[] {
  const out: AdStatusEmission[] = [];
  for (const ad of next) {
    const prevStatus = prev.get(ad.adId);
    if (!prevStatus) continue;
    if (prevStatus === ad.status) continue;
    const message = transitionMessage(prevStatus, ad.status, ad.name, ad.issueReason);
    if (!message) continue;
    out.push({
      adId: ad.adId,
      campaignId: ad.campaignId,
      message,
      transition: `${prevStatus}->${ad.status}`,
    });
  }
  return out;
}

export function snapshotMap(snapshot: AdSnapshot[]): Map<string, AdEffectiveStatus> {
  return new Map(snapshot.map((a) => [a.adId, a.status]));
}
