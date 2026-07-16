const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;

export interface OptimizeImageOptions {
  maxDimension?: number;
  quality?: number;
  outputType?: "image/jpeg" | "image/webp";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo preparar la imagen."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo comprimir la imagen."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export async function optimizeImageFile(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const maxDimension = options.maxDimension || DEFAULT_MAX_DIMENSION;
  const quality = options.quality || DEFAULT_QUALITY;
  const outputType = options.outputType || (file.type === "image/png" ? "image/jpeg" : file.type);
  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  if (scale === 1 && file.size < 1_500_000 && file.type !== "image/png") {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, outputType, quality);

  if (blob.size >= file.size && file.type === outputType) {
    return file;
  }

  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}
