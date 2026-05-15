// Combo chart — bars (e.g. clicks) + line (e.g. CTR), Wanted-DS colored.
// Ported from the design bundle. Used by /create step 03 and /campaigns/[id].
import { fmt } from "@shared/lib/format";

export default function DualChart({ labels, clicks, ctrs }: { labels: string[]; clicks: number[]; ctrs: number[] }) {
  if (clicks.length === 0) return null;
  const w = 800, h = 260, padL = 44, padR = 44, padT = 18, padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxClicks = Math.max(...clicks, 1) * 1.15;
  const maxCtr = Math.max(...ctrs, 0.1) * 1.2;
  const barW = (innerW / clicks.length) * 0.55;
  const stepX = innerW / clicks.length;

  const linePts = ctrs.map((v, i) => {
    const x = padL + stepX * i + stepX / 2;
    const y = padT + innerH - (v / maxCtr) * innerH;
    return [x, y] as const;
  });
  const lineD = linePts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 260 }}>
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = padT + innerH * (1 - t);
        return <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--w-line-alternative)" />;
      })}
      {clicks.map((v, i) => {
        const x = padL + stepX * i + (stepX - barW) / 2;
        const bh = (v / maxClicks) * innerH;
        const y = padT + innerH - bh;
        return <rect key={i} x={x} y={y} width={barW} height={Math.max(0, bh)} rx="3" fill="var(--w-primary-normal)" opacity="0.85" />;
      })}
      <path d={lineD} fill="none" stroke="var(--w-accent-violet)" strokeWidth="2.2" />
      {linePts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.4" fill="#fff" stroke="var(--w-accent-violet)" strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={padL + stepX * i + stepX / 2} y={h - 8} fontSize="11" fill="var(--w-fg-neutral)" textAnchor="middle" style={{ fontFamily: "var(--w-font-sans)", fontWeight: 500 }}>{l}</text>
      ))}
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + innerH * (1 - t) + 3;
        return <text key={i} x={padL - 10} y={y} fontSize="10" fill="var(--w-fg-alternative)" textAnchor="end" style={{ fontFamily: "var(--w-font-mono)" }}>{fmt(Math.round(maxClicks * t))}</text>;
      })}
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + innerH * (1 - t) + 3;
        return <text key={i} x={w - padR + 10} y={y} fontSize="10" fill="var(--w-fg-alternative)" textAnchor="start" style={{ fontFamily: "var(--w-font-mono)" }}>{(maxCtr * t).toFixed(1)}%</text>;
      })}
    </svg>
  );
}

export function ChartLegend({ color, label, type }: { color: string; label: string; type: "bar" | "line" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px/1 var(--w-font-sans)", color: "var(--w-fg-neutral)" }}>
      {type === "bar"
        ? <span style={{ width: 12, height: 12, background: color, borderRadius: 2 }} />
        : <span style={{ width: 14, height: 2, background: color, borderRadius: 2 }} />}
      {label}
    </span>
  );
}
