import Icon, { type IconName } from "@shared/ui/Icon";
import { Chip } from "@shared/ui/Chip";

type RouteKey = "campaigns" | "approvals" | "library" | "members" | "settings";

const ROUTE_META: Record<RouteKey, { icon: IconName; title: string; desc: string }> = {
  campaigns: { icon: "message", title: "캠페인", desc: "집행 중인 캠페인을 관리하고 성과를 추적해요." },
  approvals: { icon: "clock", title: "승인 대기", desc: "검수를 기다리는 광고 소재를 확인하고 처리해요." },
  library: { icon: "folder", title: "소재 라이브러리", desc: "지금까지 만든 광고 소재를 한 곳에서 모아 봐요." },
  members: { icon: "users", title: "구성원 · 권한", desc: "팀 구성원을 초대하고 권한을 설정해요." },
  settings: { icon: "settings", title: "설정", desc: "계정 연결, 화면 테마, 알림 등을 관리해요." },
};

export default function PlaceholderScreen({ route }: { route: RouteKey }) {
  const m = ROUTE_META[route];
  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 100px)", textAlign: "center", gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--w-primary-soft)", color: "var(--w-primary-press)", display: "grid", placeItems: "center" }}>
          <Icon name={m.icon} size={28} strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ font: "700 24px/1.25 var(--w-font-display)", color: "var(--w-fg-strong)", letterSpacing: "-0.02em", marginBottom: 8 }}>
            {m.title}
          </div>
          <div style={{ font: "500 14px/1.6 var(--w-font-sans)", color: "var(--w-fg-neutral)", maxWidth: 360 }}>{m.desc}</div>
        </div>
        <Chip variant="neutral" dot style={{ marginTop: 4 }}>준비 중</Chip>
      </div>
    </div>
  );
}
