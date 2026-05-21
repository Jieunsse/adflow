// Lucide-style line icons (1.75 stroke, 24 frame) — ported from the design bundle's icons.jsx.
import type { CSSProperties, SVGProps } from "react";

export type IconName =
  | "monitor" | "spinner" | "grid" | "sparkles" | "settings" | "sun" | "moon"
  | "logout" | "check" | "copy" | "refresh" | "arrow-right" | "arrow-left" | "plus"
  | "image" | "upload" | "calendar" | "globe" | "users" | "target" | "megaphone"
  | "chart" | "trend-up" | "trend-down" | "pause" | "play" | "info" | "warn" | "lock"
  | "bell" | "facebook" | "x" | "doc" | "wallet" | "link" | "dots" | "chev-down"
  | "message" | "clock" | "folder" | "asterisk" | "eye" | "eye-off"
  | "phone" | "heart";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  spin?: boolean;
  style?: CSSProperties;
}

const SPIN: CSSProperties = { animation: "spin 0.85s linear infinite" };

export default function Icon({ name, size = 18, strokeWidth = 1.75, spin, style, ...rest }: IconProps) {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: spin ? { ...SPIN, ...style } : style,
    ...rest,
  };
  switch (name) {
    case "monitor": return <svg {...props}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
    case "spinner": return <svg {...props} style={{ ...SPIN, ...style }}><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg>;
    case "grid": return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "sparkles": return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>;
    case "settings": return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
    case "sun": return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "moon": return <svg {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
    case "logout": return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case "check": return <svg {...props}><path d="M5 12l5 5L20 7" /></svg>;
    case "copy": return <svg {...props}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
    case "eye": return <svg {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case "eye-off": return <svg {...props}><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-2.55 3.39M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M2 2l20 20" /></svg>;
    case "phone": return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
    case "heart": return <svg {...props}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
    case "refresh": return <svg {...props}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></svg>;
    case "arrow-right": return <svg {...props}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
    case "arrow-left": return <svg {...props}><path d="M19 12H5M11 5l-7 7 7 7" /></svg>;
    case "plus": return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
    case "image": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m3 16 5-5 5 5 3-3 5 5" /></svg>;
    case "upload": return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>;
    case "globe": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
    case "users": return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>;
    case "target": return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
    case "megaphone": return <svg {...props}><path d="M3 11v2a2 2 0 0 0 2 2h3l8 5V4l-8 5H5a2 2 0 0 0-2 2Z" /><path d="M19 8a4 4 0 0 1 0 8" /></svg>;
    case "chart": return <svg {...props}><path d="M3 3v18h18" /><path d="M7 16l4-5 4 3 5-7" /></svg>;
    case "trend-up": return <svg {...props}><path d="M3 17 9 11l4 4 8-9" /><path d="M14 7h7v7" /></svg>;
    case "trend-down": return <svg {...props}><path d="M3 7l6 6 4-4 8 9" /><path d="M14 18h7v-7" /></svg>;
    case "pause": return <svg {...props}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>;
    case "play": return <svg {...props}><path d="M6 4l14 8-14 8z" /></svg>;
    case "info": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5" /></svg>;
    case "warn": return <svg {...props}><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "lock": return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case "bell": return <svg {...props}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
    case "facebook": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} {...rest}><path d="M24 12C24 5.4 18.6 0 12 0S0 5.4 0 12c0 6 4.4 11 10.1 11.9V15.5h-3v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4C19.6 23 24 18 24 12Z" /></svg>;
    case "x": return <svg {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    case "doc": return <svg {...props}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>;
    case "wallet": return <svg {...props}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 14h2" /></svg>;
    case "link": return <svg {...props}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>;
    case "dots": return <svg {...props}><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></svg>;
    case "chev-down": return <svg {...props}><path d="m6 9 6 6 6-6" /></svg>;
    case "message": return <svg {...props}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-5.3A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" /></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "folder": return <svg {...props}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
    case "asterisk": return <svg {...props}><path d="M12 3v18M5 7l14 10M19 7 5 17" /></svg>;
    default: return null;
  }
}
