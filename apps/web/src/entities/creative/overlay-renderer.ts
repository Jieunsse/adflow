const CANVAS_PX = 1024;
export const FONT_FAMILY = "Pretendard";
export const LINE_HEIGHT = 1.25;
const HALO_BLUR_RATIO = 0.015;
const SOFT_BLUR_RATIO = 0.18;
const SOFT_OFFSET_RATIO = 0.012;
const HALO_LIGHT = "rgba(255,255,255,0.9)";
const HALO_DARK = "rgba(0,0,0,0.9)";
const SOFT_SHADOW = "rgba(0,0,0,0.35)";
const BAND_DARK = 0.55;

export const BAND_HEIGHT_PCT = 35;

export type Align = "left" | "center" | "right";
export type Preset = "title" | "subtitle" | "hook";
export type TemplateId = "A" | "B" | "C" | "D" | "E";
export type Band = "top" | "bottom" | null;

export type Block = {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  fontPct: number;
  color: string;
  align: Align;
  weight: 400 | 700;
  outline: boolean;
};

export const PRESETS: Record<Preset, { label: string; base: Omit<Block, "id"> }> = {
  title: {
    label: "타이틀",
    base: { text: "타이틀을 입력하세요", xPct: 50, yPct: 18, fontPct: 9, color: "#ffffff", align: "center", weight: 700, outline: true },
  },
  subtitle: {
    label: "부제",
    base: { text: "부제를 입력하세요", xPct: 50, yPct: 31, fontPct: 5, color: "#ffffff", align: "center", weight: 400, outline: true },
  },
  hook: {
    label: "후킹 문구",
    base: { text: "지금 확인하세요", xPct: 50, yPct: 84, fontPct: 6.5, color: "#ffffff", align: "center", weight: 700, outline: true },
  },
};

const titleBase = (over: Partial<Omit<Block, "id">>): Omit<Block, "id"> => ({
  text: "", xPct: 50, yPct: 50, fontPct: 9, color: "#ffffff", align: "center", weight: 700, outline: true, ...over,
});

export const TEMPLATES: Record<TemplateId, { label: string; band: Band; blocks: Omit<Block, "id">[] }> = {
  A: {
    label: "하단 밴드", band: "bottom",
    blocks: [titleBase({ yPct: 78, fontPct: 9.5 }), titleBase({ yPct: 89, fontPct: 4.5, weight: 400 })],
  },
  B: {
    label: "상단 중앙", band: "top",
    blocks: [titleBase({ yPct: 16, fontPct: 9 }), titleBase({ yPct: 28, fontPct: 5, weight: 400 })],
  },
  C: { label: "중앙 강조", band: null, blocks: [titleBase({ yPct: 50, fontPct: 11 })] },
  D: { label: "빈 시작", band: null, blocks: [] },
  E: {
    label: "좌하단", band: "bottom",
    blocks: [
      titleBase({ align: "left", xPct: 6, yPct: 80, fontPct: 6.5 }),
      titleBase({ align: "left", xPct: 6, yPct: 89, fontPct: 4, weight: 400 }),
    ],
  },
};

export function pickTemplate(template: TemplateId, headline?: string, subtitle?: string): Block[] {
  return TEMPLATES[template].blocks.map((base, index) => ({
    id: `t${template}-${index}`,
    ...base,
    text: index === 0 ? headline?.trim() || "여기에 표제를 입력하세요" : subtitle?.trim() || "부가 문구",
  }));
}

export function resolveAnchor(align: Align, x: number, _maxWidth: number): { textAlign: CanvasTextAlign; x: number } {
  return { textAlign: align, x };
}

export function previewTextShadow(block: Pick<Block, "color" | "fontPct" | "outline">): string {
  if (!block.outline) return "none";
  return `0 ${block.fontPct * SOFT_OFFSET_RATIO}cqw ${block.fontPct * SOFT_BLUR_RATIO}cqw ${SOFT_SHADOW}, 0 0 ${block.fontPct * HALO_BLUR_RATIO}cqw ${haloColor(block.color)}`;
}

export function bandGradient(band: Exclude<Band, null>): string {
  return band === "bottom"
    ? `linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,${BAND_DARK}))`
    : `linear-gradient(to top, rgba(0,0,0,0), rgba(0,0,0,${BAND_DARK}))`;
}

export async function compose(baseUrl: string, blocks: Block[], band: Band = null): Promise<string> {
  await Promise.all([
    document.fonts.load(`400 80px ${FONT_FAMILY}`),
    document.fonts.load(`700 80px ${FONT_FAMILY}`),
  ]).catch(() => {});

  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = baseUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas 2d context 를 얻지 못했어요");

  const scale = Math.max(CANVAS_PX / image.width, CANVAS_PX / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (CANVAS_PX - width) / 2, (CANVAS_PX - height) / 2, width, height);

  if (band) {
    const bandHeight = (BAND_HEIGHT_PCT / 100) * CANVAS_PX;
    const gradient = band === "bottom"
      ? context.createLinearGradient(0, CANVAS_PX - bandHeight, 0, CANVAS_PX)
      : context.createLinearGradient(0, bandHeight, 0, 0);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${BAND_DARK})`);
    context.fillStyle = gradient;
    context.fillRect(0, band === "bottom" ? CANVAS_PX - bandHeight : 0, CANVAS_PX, bandHeight);
  }

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    const fontPx = (block.fontPct / 100) * CANVAS_PX;
    const lineHeight = fontPx * LINE_HEIGHT;
    const lines = text.split("\n");
    context.font = `${block.weight} ${fontPx}px ${FONT_FAMILY}`;
    context.textBaseline = "middle";
    const maxWidth = Math.max(...lines.map((line) => context.measureText(line).width));
    const x = (block.xPct / 100) * CANVAS_PX;
    const top = (block.yPct / 100) * CANVAS_PX - (lines.length * lineHeight) / 2;

    lines.forEach((line, index) => {
      const anchor = resolveAnchor(block.align, x, maxWidth);
      context.textAlign = anchor.textAlign;
      context.fillStyle = block.color;
      const y = top + index * lineHeight + lineHeight / 2;
      if (block.outline) {
        context.shadowColor = SOFT_SHADOW;
        context.shadowBlur = fontPx * SOFT_BLUR_RATIO;
        context.shadowOffsetY = fontPx * SOFT_OFFSET_RATIO;
        context.fillText(line, anchor.x, y);
        context.shadowColor = haloColor(block.color);
        context.shadowBlur = fontPx * HALO_BLUR_RATIO;
        context.shadowOffsetY = 0;
        context.fillText(line, anchor.x, y);
      } else {
        context.shadowBlur = 0;
        context.fillText(line, anchor.x, y);
      }
    });
  }

  return canvas.toDataURL("image/png");
}

function haloColor(color: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return HALO_LIGHT;
  const value = parseInt(match[1], 16);
  const brightness = ((0.299 * ((value >> 16) & 255)) + (0.587 * ((value >> 8) & 255)) + (0.114 * (value & 255))) / 255;
  return brightness > 0.6 ? HALO_LIGHT : HALO_DARK;
}
