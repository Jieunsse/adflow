"use client";

// 큰 data:image data URL 을 캔버스로 축소한다. 둘러보기(localStorage) 토너먼트가 챔피언/챌린저로
// 2MB PNG 를 통째로 복사·저장하다 용량(~5MB)을 넘겨 조용히 버려지는 걸 막는 용도.
// 작은(<256KB) 이미지나 비-raster(SVG 데모 이미지)는 원본 그대로 둔다. 어떤 실패에도 원본을 돌려줘 안전.
export async function shrinkImageDataUrl(url: string, maxDim = 720, quality = 0.82): Promise<string> {
  if (typeof window === "undefined" || !url) return url;
  if (!/^data:image\/(png|jpe?g|webp)/i.test(url) || url.length < 256 * 1024) return url;
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return url;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
