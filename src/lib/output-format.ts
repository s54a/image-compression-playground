import type { ImageFormat } from "./compression";

let webpSupport: Promise<boolean> | undefined;

function canEncodeWebP(): Promise<boolean> {
  webpSupport ??= new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      canvas.toBlob((blob) => resolve(blob?.type === "image/webp"), "image/webp");
    } catch {
      resolve(false);
    }
  });
  return webpSupport;
}

export async function outputFormat(
  requested: ImageFormat,
  sourceType: string,
): Promise<ImageFormat> {
  if (requested !== "image/webp" || (await canEncodeWebP())) return requested;
  // Only JPEG is guaranteed opaque. Keep possible transparency in other inputs.
  return sourceType === "image/jpeg" ? "image/jpeg" : "image/png";
}
