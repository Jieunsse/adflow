"use client";

import { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

interface Props {
  value: string; // "YYYY-MM-DD"
  onChange: (v: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toStr(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date();
  const todayStr = toStr(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );

  const initYear = value ? parseInt(value.slice(0, 4)) : today.getFullYear();
  const initMonth = value ? parseInt(value.slice(5, 7)) : today.getMonth() + 1;
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.slice(0, 4)));
      setViewMonth(parseInt(value.slice(5, 7)));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else setViewMonth((m) => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();

  const displayValue = value
    ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`
    : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--w-bg-elevated)",
          border: `1px solid ${open ? "var(--w-primary-normal)" : "var(--w-line-normal)"}`,
          boxShadow: open ? "0 0 0 4px var(--w-focus-ring)" : "none",
          borderRadius: 12,
          padding: "11px 14px",
          font: "500 14px/1.5 var(--w-font-sans)",
          color: displayValue
            ? "var(--w-fg-strong)"
            : "var(--w-fg-alternative)",
          cursor: "pointer",
          textAlign: "left",
          whiteSpace: "nowrap",
          transition: "border-color 120ms, box-shadow 120ms",
        }}
      >
        <Icon
          name="calendar"
          size={15}
          style={{ color: "var(--w-fg-neutral)", flexShrink: 0 }}
        />
        <span style={{ flex: 1 }}>{displayValue || placeholder}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 300,
            background: "var(--w-bg-elevated)",
            border: "1px solid var(--w-line-normal)",
            borderRadius: 16,
            boxShadow: "var(--w-shadow-strong)",
            padding: "14px 12px",
            width: 272,
          }}
        >
          {/* 월 네비게이션 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <button type="button" onClick={prevMonth} style={NAV_BTN}>
              <Icon name="arrow-left" size={14} />
            </button>
            <span
              style={{
                font: "600 14px/1 var(--w-font-sans)",
                color: "var(--w-fg-strong)",
              }}
            >
              {viewYear}년 {viewMonth}월
            </span>
            <button type="button" onClick={nextMonth} style={NAV_BTN}>
              <Icon name="arrow-right" size={14} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              marginBottom: 4,
            }}
          >
            {DOW.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  font: "500 11px/2 var(--w-font-sans)",
                  color: "var(--w-fg-neutral)",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
            }}
          >
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const str = toStr(viewYear, viewMonth, day);
              const selected = str === value;
              const isToday = str === todayStr;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(str);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: 8,
                    border: "none",
                    background: selected
                      ? "var(--w-accent-violet)"
                      : isToday
                        ? "var(--w-accent-violet-soft)"
                        : "transparent",
                    color: selected
                      ? "var(--w-fg-on-color)"
                      : isToday
                        ? "var(--w-accent-violet)"
                        : "var(--w-fg-normal)",
                    font: `${selected || isToday ? "600" : "400"} 13px/1 var(--w-font-sans)`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "background 80ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "var(--w-bg-neutral)";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        isToday ? "var(--w-accent-violet-soft)" : "transparent";
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* 빠른 선택 버튼 */}
          <div
            style={{
              borderTop: "1px solid var(--w-line-alternative)",
              marginTop: 8,
              paddingTop: 8,
              display: "flex",
              gap: 6,
              justifyContent: "center",
            }}
          >
            {[
              { label: "오늘", getDate: () => new Date() },
              {
                label: "일주일",
                getDate: () => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  return d;
                },
              },
              {
                label: "한달",
                getDate: () => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 1);
                  return d;
                },
              },
            ].map(({ label, getDate }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const d = getDate();
                  const str = toStr(
                    d.getFullYear(),
                    d.getMonth() + 1,
                    d.getDate(),
                  );
                  onChange(str);
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth() + 1);
                  setOpen(false);
                }}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  border: "1px solid var(--w-line-normal)",
                  background: "transparent",
                  font: "500 12px/1 var(--w-font-sans)",
                  color: "var(--w-accent-violet)",
                  cursor: "pointer",
                  transition: "background 80ms, border-color 80ms",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "var(--w-accent-violet-soft)";
                  el.style.borderColor = "var(--w-accent-violet)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "transparent";
                  el.style.borderColor = "var(--w-line-normal)";
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "1px solid var(--w-line-normal)",
  background: "transparent",
  color: "var(--w-fg-normal)",
  cursor: "pointer",
};
