/** Procesado de imágenes en el navegador antes de subirlas (fotos de perfil y logo del club). */

export const IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_SIDE = 512;

/**
 * Rectángulo de la imagen que tiene contenido: sin los bordes transparentes o casi blancos.
 * Si no encuentra nada (imagen vacía o toda blanca) devuelve la imagen entera.
 */
function contentBounds(bitmap: ImageBitmap): { x: number; y: number; width: number; height: number } {
  const full = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const sample = 256;
  const scale = Math.min(1, sample / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return full;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const transparent = data[i + 3] < 16;
      const white = data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
      if (transparent || white) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return full;

  // Un pequeño aire alrededor, en píxeles de la imagen original.
  const pad = Math.round(Math.max(bitmap.width, bitmap.height) * 0.01);
  const x = Math.max(0, Math.floor(minX / scale) - pad);
  const y = Math.max(0, Math.floor(minY / scale) - pad);
  return {
    x,
    y,
    width: Math.min(bitmap.width - x, Math.ceil((maxX + 1) / scale) - x + pad),
    height: Math.min(bitmap.height - y, Math.ceil((maxY + 1) / scale) - y + pad),
  };
}

/** Lado mayor del logo guardado, en píxeles. */
export const LOGO_MAX_SIDE = 640;

/**
 * Logo del club como WebP: sin márgenes vacíos (transparentes o blancos) y conservando su forma, de
 * modo que un logo apaisado no queda chico dentro de un cuadrado. Lado mayor de hasta 640 px, sobre
 * fondo blanco y con un pequeño aire alrededor.
 */
export async function toLogoWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const box = contentBounds(bitmap);
  const margin = 12;
  const scale = Math.min(2, (LOGO_MAX_SIDE - margin * 2) / Math.max(box.width, box.height));
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width + margin * 2;
  canvas.height = height + margin * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, box.x, box.y, box.width, box.height, margin, margin, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

/** Foto de persona como WebP cuadrado de 512×512, recortada al centro. */
export async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIDE;
  canvas.height = IMAGE_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");

  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    IMAGE_SIDE,
    IMAGE_SIDE
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}
