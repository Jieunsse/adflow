export const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : Number(n).toLocaleString("ko-KR");

export const fmtKRW = (n: number | null | undefined): string => "₩" + fmt(n);

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Deterministic gradient for campaign thumbnails — no real creative thumbnails are stored yet.
const CAMPAIGN_GRADIENTS = [
  "linear-gradient(135deg,#0066ff,#6541f2)", "linear-gradient(135deg,#ff7a59,#ffb24d)",
  "linear-gradient(135deg,#2c3e50,#6e8aa6)", "linear-gradient(135deg,#c2185b,#f48fb1)",
  "linear-gradient(135deg,#00bdde,#0066ff)", "linear-gradient(135deg,#008a2e,#49e57d)",
  "linear-gradient(135deg,#9c5800,#ffb24d)", "linear-gradient(135deg,#6541f2,#c2185b)",
];
export function campaignGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CAMPAIGN_GRADIENTS[h % CAMPAIGN_GRADIENTS.length];
}

export function kDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function campaignDateInfo(
  startDate: string | null,
  endDate: string | null,
  status: string,
): { daysLine: string; progressLine: string } {
  const daysLine = startDate && endDate ? `${kDate(startDate)} – ${kDate(endDate)}` : startDate ? kDate(startDate) : "—";
  let progressLine: string;
  if (status === "review") progressLine = "검토 중";
  else if (status === "issue") progressLine = "집행 중단";
  else if (status === "ended") progressLine = startDate ? "종료됨" : "—";
  else if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) progressLine = "—";
    else if (now < start) progressLine = "곧 시작";
    else {
      const total = Math.max(1, Math.round((end - start) / 86400000) + 1);
      const remain = Math.round((end - now) / 86400000);
      if (remain >= 0 && remain <= 3) progressLine = `종료 D-${remain} 남음`;
      else progressLine = `D+${Math.round((now - start) / 86400000)} / ${total}일 중`;
    }
  } else progressLine = status === "live" ? "게재 중" : "—";
  return { daysLine, progressLine };
}

export function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  const dt = new Date(ts);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}
