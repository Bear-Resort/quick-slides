import { isEditorImageUrl, resolveEditorImageSrc } from "@/lib/editorImages";
import { extractBackgroundImageUrl } from "@/lib/exportCapture";

const dataUrlCache = new Map<string, string>();

/** Max pixel dimension for embedded slide images (reduces HTML/PDF payload). */
const MAX_EMBED_DIMENSION = 1920;
const EMBED_JPEG_QUALITY = 0.88;

function resolveAbsoluteImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;
  if (isEditorImageUrl(trimmed)) {
    return resolveEditorImageSrc(trimmed) || trimmed;
  }
  try {
    return new URL(trimmed, window.location.href).href;
  } catch {
    return trimmed;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image blob"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

async function rasterizeImageElement(img: HTMLImageElement): Promise<string> {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width <= 0 || height <= 0) return img.src;

  const scale = Math.min(1, MAX_EMBED_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const usePng = img.src.endsWith(".png") || img.src.includes(".png?");
  return usePng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", EMBED_JPEG_QUALITY);
}

async function compressBlobToDataUrl(blob: Blob): Promise<string> {
  if (blob.type === "image/svg+xml") {
    return blobToDataUrl(blob);
  }

  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(
        1,
        MAX_EMBED_DIMENSION / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return blobToDataUrl(blob);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const preferPng = blob.type === "image/png" || blob.type === "image/webp";
      return preferPng
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", EMBED_JPEG_QUALITY);
    } finally {
      bitmap.close();
    }
  } catch {
    return blobToDataUrl(blob);
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const absolute = resolveAbsoluteImageUrl(url);
  if (!absolute) return url;
  if (absolute.startsWith("data:")) return absolute;

  const cached = dataUrlCache.get(absolute);
  if (cached) return cached;

  try {
    const response = await fetch(absolute);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const dataUrl = await compressBlobToDataUrl(blob);
    dataUrlCache.set(absolute, dataUrl);
    return dataUrl;
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        void rasterizeImageElement(img)
          .then((dataUrl) => {
            dataUrlCache.set(absolute, dataUrl);
            resolve(dataUrl);
          })
          .catch(() => resolve(url));
      };
      img.onerror = () => resolve(url);
      img.src = absolute;
    });
  }
}

/** Hide loading placeholders and show images that finished loading before capture. */
export function revealLoadedImagesForCapture(root: ParentNode): void {
  root.querySelectorAll(".slide-image-panel").forEach((panel) => {
    const img = panel.querySelector("img");
    if (!(img instanceof HTMLImageElement)) return;
    if (!img.complete || img.naturalWidth === 0) return;

    img.classList.remove("sr-only");
    const placeholder = panel.querySelector(".border-dashed");
    if (placeholder instanceof HTMLElement) {
      placeholder.style.display = "none";
    }
  });
}

/** Replace img/background URLs with embedded data URLs for standalone HTML and reliable capture. */
export async function embedImagesForExport(root: ParentNode): Promise<void> {
  const imgTasks: Promise<void>[] = [];

  root.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) return;

    imgTasks.push(
      fetchImageAsDataUrl(src).then((dataUrl) => {
        if (dataUrl.startsWith("data:")) {
          img.setAttribute("src", dataUrl);
        }
      }),
    );
  });

  const bgTasks: Promise<void>[] = [];
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const backgroundImage = getComputedStyle(element).backgroundImage;
    if (!backgroundImage || backgroundImage === "none") return;

    const url = extractBackgroundImageUrl(backgroundImage);
    if (!url || url.startsWith("data:")) return;

    bgTasks.push(
      fetchImageAsDataUrl(url).then((dataUrl) => {
        if (dataUrl.startsWith("data:")) {
          element.style.backgroundImage = `url("${dataUrl}")`;
        }
      }),
    );
  });

  await Promise.all([...imgTasks, ...bgTasks]);
}

const CSS_URL_PATTERN = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;

/** Embed remote asset URLs inside exported CSS so standalone HTML works offline. */
export async function embedUrlsInCss(css: string): Promise<string> {
  const rawUrls = new Set<string>();
  for (const match of css.matchAll(CSS_URL_PATTERN)) {
    const raw = match[2]?.trim();
    if (raw && !raw.startsWith("data:")) {
      rawUrls.add(raw);
    }
  }

  const replacements = new Map<string, string>();
  await Promise.all(
    [...rawUrls].map(async (raw) => {
      const dataUrl = await fetchImageAsDataUrl(raw);
      if (dataUrl.startsWith("data:")) {
        replacements.set(raw, dataUrl);
      }
    }),
  );

  if (replacements.size === 0) return css;

  return css.replace(CSS_URL_PATTERN, (full, _quote, raw: string) => {
    const embedded = replacements.get(raw.trim());
    return embedded ? `url("${embedded}")` : full;
  });
}

export function clearExportImageCache(): void {
  dataUrlCache.clear();
}
