// PNG helpers for screenshots: data URLs ↔ bytes, contact sheets and model-sized copies.

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function bytesToObjectUrl(bytes: Uint8Array, type = "image/png"): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
}

async function bitmapOf(bytes: Uint8Array): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart], { type: "image/png" }));
}

async function canvasToBytes(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));
  if (!blob) throw new Error("Could not encode the image");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Tiles frames into one PNG with a label in each corner, like drive.mjs sheets. */
export async function tile(frames: Uint8Array[], labels: string[], columns: number): Promise<Uint8Array> {
  const images = await Promise.all(frames.map(bitmapOf));
  const w = images[0].width;
  const h = images[0].height;
  const rows = Math.ceil(images.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = w * columns;
  canvas.height = h * rows;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 12px monospace";
  images.forEach((image, index) => {
    const x = (index % columns) * w;
    const y = Math.floor(index / columns) * h;
    ctx.drawImage(image, x, y);
    ctx.fillStyle = "#ff00aa";
    ctx.fillText(labels[index], x + 6, y + 16);
  });
  return canvasToBytes(canvas);
}

export interface ModelImage {
  mediaType: "image/png" | "image/jpeg";
  base64: string;
  width: number;
  height: number;
}

/** Scales a screenshot down to what a vision model reads in full (long edge ≤ maxEdge). */
export async function forModel(bytes: Uint8Array, maxEdge = 1568): Promise<ModelImage> {
  const image = await bitmapOf(bytes);
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
  if (ratio === 1 && bytes.length < 3_500_000) return { mediaType: "image/png", base64: bytesToBase64(bytes), width: image.width, height: image.height };
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  let out = await canvasToBytes(canvas);
  let mediaType: ModelImage["mediaType"] = "image/png";
  if (out.length > 3_500_000) {
    out = await canvasToBytes(canvas, "image/jpeg", 0.9);
    mediaType = "image/jpeg";
  }
  return { mediaType, base64: bytesToBase64(out), width: canvas.width, height: canvas.height };
}

/** A small JPEG data URL for history thumbnails. */
export async function thumbnail(bytes: Uint8Array, width = 480): Promise<string> {
  const image = await bitmapOf(bytes);
  const ratio = Math.min(1, width / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}
