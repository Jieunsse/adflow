// 데모 광고 목업 이미지 — 자체 SVG data-URI (외부 에셋·gitignore 의존 없음, 항상 렌더).
// 그린루틴 비건 스킨케어 테마 1:1 크리에이티브 3종 — 자연광·연한 그린/베이지 톤의 제품 용기.

type Palette = {
  bg1: string;
  bg2: string;
  bottle: string;
  accent: string;
  badge: string;
  sub: string;
};

const PALETTES: Palette[] = [
  { bg1: "#eaf5ec", bg2: "#bfe0c8", bottle: "#f3faf4", accent: "#2f7d4f", badge: "수분 가득", sub: "MOISTURE CREAM" },
  { bg1: "#f4f0e6", bg2: "#ddd2bb", bottle: "#fbf8f0", accent: "#7a6a3e", badge: "비건", sub: "VEGAN SKINCARE" },
  { bg1: "#edf6f1", bg2: "#cbe9dc", bottle: "#f2faf6", accent: "#1f7a5c", badge: "순하게", sub: "GENTLE CARE" },
];

function svg(p: Palette): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient>
    <linearGradient id="bt" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${p.bottle}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="150" cy="120" r="220" fill="#ffffff" opacity="0.18"/>
  <!-- leaf accents -->
  <g fill="${p.accent}" opacity="0.5">
    <path d="M120 470 q40 -60 96 -56 q-22 52 -96 56 z"/>
    <path d="M462 150 q-44 -54 -100 -42 q26 50 100 42 z"/>
  </g>
  <!-- cosmetic bottle -->
  <g transform="translate(0,4)">
    <!-- pump cap -->
    <rect x="282" y="138" width="36" height="44" rx="6" fill="${p.accent}" opacity="0.9"/>
    <rect x="272" y="178" width="56" height="20" rx="6" fill="${p.accent}"/>
    <!-- nozzle -->
    <rect x="294" y="120" width="12" height="22" rx="4" fill="${p.accent}" opacity="0.75"/>
    <!-- body -->
    <rect x="236" y="198" width="128" height="266" rx="26" fill="url(#bt)" stroke="${p.accent}" stroke-opacity="0.18" stroke-width="2"/>
    <!-- highlight -->
    <rect x="252" y="218" width="16" height="226" rx="8" fill="#ffffff" opacity="0.6"/>
    <!-- label band -->
    <rect x="236" y="300" width="128" height="92" fill="${p.accent}" opacity="0.1"/>
    <rect x="258" y="328" width="84" height="8" rx="4" fill="${p.accent}" opacity="0.55"/>
    <rect x="272" y="350" width="56" height="6" rx="3" fill="${p.accent}" opacity="0.35"/>
    <!-- droplet -->
    <circle cx="300" cy="252" r="9" fill="${p.accent}" opacity="0.4"/>
  </g>
  <!-- badge -->
  <g transform="translate(40,44)">
    <rect width="150" height="44" rx="22" fill="${p.accent}"/>
    <text x="75" y="29" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" font-weight="700" fill="#ffffff">${p.badge}</text>
  </g>
  <!-- bottom -->
  <text x="300" y="528" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="15" font-weight="600" letter-spacing="3" fill="${p.accent}">${p.sub}</text>
  <text x="300" y="558" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" font-weight="500" fill="${p.accent}" opacity="0.7">GREENROUTINE</text>
</svg>`;
}

export const DEMO_AD_IMAGES: string[] = PALETTES.map(
  (p) => `data:image/svg+xml;utf8,${encodeURIComponent(svg(p))}`,
);
