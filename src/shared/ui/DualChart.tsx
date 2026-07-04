// Combo chart — bars (좌축) + line (우축), Wanted-DS colored.
// ADR-059 — clicks/ctrs 박힌 계약을 bars/line + 축 라벨로 일반화.
// 좌축 막대 = 지출/클릭 등, 우축 라인 = CTR/매출/도착 등. lineFormat 으로 우축 눈금 표기.
import { fmt } from "@shared/lib/format";

export default function DualChart({
  labels,
  bars,
  line,
  lineFormat = (v) => v.toFixed(1),
}: {
  labels: string[];
  bars: number[];
  line: number[];
  lineFormat?: (v: number) => string;
}) {
  if (bars.length === 0) return null;
  const w = 800,
    h = 260,
    padL = 44,
    padR = 44,
    padT = 18,
    padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxBar = Math.max(...bars, 1) * 1.15;
  const maxLine = Math.max(...line, 0.1) * 1.2;
  const barW = (innerW / bars.length) * 0.55;
  const stepX = innerW / bars.length;

  const linePts = line.map((v, i) => {
    const x = padL + stepX * i + stepX / 2;
    const y = padT + innerH - (v / maxLine) * innerH;
    return [x, y] as const;
  });
  const lineD = linePts
    .map(
      (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1),
    )
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 260 }}>
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = padT + innerH * (1 - t);
        return (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={w - padR}
            y2={y}
            stroke="var(--w-line-alternative)"
          />
        );
      })}
      {bars.map((v, i) => {
        const x = padL + stepX * i + (stepX - barW) / 2;
        const bh = (v / maxBar) * innerH;
        const y = padT + innerH - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(0, bh)}
            rx="3"
            fill="var(--w-primary-normal)"
            opacity="0.85"
          />
        );
      })}
      <path
        d={lineD}
        fill="none"
        stroke="var(--w-accent-violet)"
        strokeWidth="2.2"
      />
      {linePts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="3.4"
          fill="var(--w-common-100)"
          stroke="var(--w-accent-violet)"
          strokeWidth="2"
        />
      ))}
      {labels.map((l, i) => (
        <text
          key={i}
          x={padL + stepX * i + stepX / 2}
          y={h - 8}
          fontSize="11"
          fill="var(--w-fg-neutral)"
          textAnchor="middle"
          style={{ fontFamily: "var(--w-font-sans)", fontWeight: 500 }}
        >
          {l}
        </text>
      ))}
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + innerH * (1 - t) + 3;
        return (
          <text
            key={i}
            x={padL - 10}
            y={y}
            fontSize="10"
            fill="var(--w-fg-alternative)"
            textAnchor="end"
            style={{ fontFamily: "var(--w-font-mono)" }}
          >
            {fmt(Math.round(maxBar * t))}
          </text>
        );
      })}
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + innerH * (1 - t) + 3;
        return (
          <text
            key={i}
            x={w - padR + 10}
            y={y}
            fontSize="10"
            fill="var(--w-fg-alternative)"
            textAnchor="start"
            style={{ fontFamily: "var(--w-font-mono)" }}
          >
            {lineFormat(maxLine * t)}
          </text>
        );
      })}
    </svg>
  );
}

export function ChartLegend({
  color,
  label,
  type,
}: {
  color: string;
  label: string;
  type: "bar" | "line";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        font: "500 12px/1 var(--w-font-sans)",
        color: "var(--w-fg-neutral)",
      }}
    >
      {type === "bar" ? (
        <span
          style={{ width: 12, height: 12, background: color, borderRadius: 2 }}
        />
      ) : (
        <span
          style={{ width: 14, height: 2, background: color, borderRadius: 2 }}
        />
      )}
      {label}
    </span>
  );
}
