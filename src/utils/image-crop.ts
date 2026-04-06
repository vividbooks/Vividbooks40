/**
 * Ořez obrázku z URL (canvas) — výstup PNG data URL pro upload do Storage.
 * Obrázek se nejdřív stáhne jako blob a načte přes blob: URL → canvas není „tainted“ kvůli CORS u veřejných Storage URL.
 */
export type NormalizedBox = { x: number; y: number; w: number; h: number };

const MIN_OUTPUT_PX = 24;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function cropLoadedImageToPngDataUrl(img: HTMLImageElement, box: NormalizedBox): string | null {
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  let w = clamp01(box.w);
  let h = clamp01(box.h);
  if (w < 0.015 || h < 0.015) return null;
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w < 0.015 || h < 0.015) return null;

  try {
    const sw = Math.max(1, Math.round(img.naturalWidth * w));
    const sh = Math.max(1, Math.round(img.naturalHeight * h));
    if (sw < MIN_OUTPUT_PX || sh < MIN_OUTPUT_PX) return null;
    const sx = Math.round(img.naturalWidth * x);
    const sy = Math.round(img.naturalHeight * y);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.startsWith('data:image/png') ? dataUrl : null;
  } catch {
    return null;
  }
}

/**
 * Načte obrázek z URL přes fetch→blob (kvůli CORS a canvas), vykreslí normalizovaný výřez (x,y,w,h v 0–1).
 */
export async function cropNormalizedRegionToPngDataUrl(
  imageUrl: string,
  box: NormalizedBox,
): Promise<string | null> {
  let objectUrl: string | null = null;
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(cropLoadedImageToPngDataUrl(img, box));
      };
      img.onerror = () => resolve(null);
      img.src = objectUrl!;
    });
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
