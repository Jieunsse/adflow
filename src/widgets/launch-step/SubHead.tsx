// launch-step 내부의 작은 helper — 섹션 제목+부제 묶음.

export default function SubHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ font: "600 14px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)", letterSpacing: "-0.004em" }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ font: "400 13px/1.45 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
