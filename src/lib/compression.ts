export type ImageInfo = { file: File; url: string; width: number; height: number };
export type CompressionResult = ImageInfo & { elapsed: number; targetBytes: number; downloadName: string };
export type CompressionStatus = "idle" | "loading" | "compressing" | "done" | "cancelled" | "error";
export type ImageFormat = "image/webp" | "image/jpeg" | "image/png";
export type CompressionLevel = "detail" | "balanced" | "small";
export const formatExtensions: Record<ImageFormat, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export type CompressionPreset = {
  id: CompressionLevel;
  label: string;
  description: string;
  quality: number;
  target: string;
  dimension: string;
};

export const compressionLevels: CompressionPreset[] = [
  {
    id: "detail",
    label: "High detail",
    description: "Keep more texture",
    quality: 92,
    target: "350",
    dimension: "2560",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "A little of both",
    quality: 82,
    target: "200",
    dimension: "1920",
  },
  {
    id: "small",
    label: "Small file",
    description: "Make room",
    quality: 65,
    target: "100",
    dimension: "1280",
  },
];

export function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () =>
      reject(new Error("This image could not be opened. Try another JPEG, PNG, or WebP file."));
    img.src = url;
  });
}

export function validateImageFile(file: File): File {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supported: Record<string, ImageFormat> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if (file.type === "image/gif" || extension === "gif")
    throw new Error("GIF images are not supported. Choose a still JPEG, PNG, or WebP image.");
  if (file.type.includes("hei") || extension === "heic" || extension === "heif")
    throw new Error("HEIC and HEIF images are not supported. Export the photo as JPEG first.");
  if (!file.size) throw new Error("This file is empty. Choose another image.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("This image is over 20 MB. Choose a smaller file.");
  const type = file.type || (extension ? supported[extension] : undefined);
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp")
    throw new Error("Choose a JPEG, PNG, or WebP image. Other formats are not supported.");
  return file.type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}
