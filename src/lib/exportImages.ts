import { isEditorImageUrl, resolveEditorImageSrc } from "@/lib/editorImages";
import { isDeckImagePath } from "@/lib/library/deckFormat";
import { readDeckImageBlob } from "@/lib/library/deckImages";
import { extractBackgroundImageUrl } from "@/lib/exportCapture";

const dataUrlCache = new Map<string, string>();

export type ExportImageOptions = {
  deckHandle?: FileSystemDirectoryHandle | null;
  deckId?: string | null;
  /** Max longest edge when embedding images (default 1920). */
  maxEmbedDimension?: number;
  /** JPEG/WebP quality 0–1 when encoding (default 0.88). */
  jpegQuality?: number;
  /** Prefer JPEG even for PNG/WebP sources (smaller print/PDF payloads). */
  forceJpeg?: boolean;
  /**
   * Prefer lossy WebP with alpha when source has transparency (much smaller than PNG).
   * Falls back to PNG if the browser cannot encode WebP.
   */
  preferWebp?: boolean;
};

/** Max pixel dimension for embedded slide images (reduces HTML/PDF payload). */
const DEFAULT_MAX_EMBED_DIMENSION = 1920;
const DEFAULT_EMBED_JPEG_QUALITY = 0.88;

function resolveAbsoluteImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (isEditorImageUrl(trimmed)) {
    return resolveEditorImageSrc(trimmed) || trimmed;
  }
  if (isDeckImagePath(trimmed)) {
    return trimmed;
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

function embedLimits(options?: ExportImageOptions): {
  maxDimension: number;
  jpegQuality: number;
  forceJpeg: boolean;
  preferWebp: boolean;
} {
  return {
    maxDimension: options?.maxEmbedDimension ?? DEFAULT_MAX_EMBED_DIMENSION,
    jpegQuality: options?.jpegQuality ?? DEFAULT_EMBED_JPEG_QUALITY,
    forceJpeg: options?.forceJpeg ?? false,
    preferWebp: options?.preferWebp ?? false,
  };
}

function cacheKeyFor(url: string, options?: ExportImageOptions): string {
  const { maxDimension, jpegQuality, forceJpeg, preferWebp } = embedLimits(options);
  return `${url}|${maxDimension}|${jpegQuality}|${forceJpeg ? "j" : "n"}|${preferWebp ? "w" : "p"}`;
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  opts: { forceJpeg: boolean; jpegQuality: number; preferWebp: boolean; keepAlpha: boolean },
): string {
  if (opts.keepAlpha && opts.preferWebp) {
    const webp = canvas.toDataURL("image/webp", opts.jpegQuality);
    if (webp.startsWith("data:image/webp")) return webp;
  }
  if (opts.keepAlpha && !opts.forceJpeg) {
    return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", opts.jpegQuality);
}

async function rasterizeImageElement(
  img: HTMLImageElement,
  options?: ExportImageOptions,
): Promise<string> {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (width <= 0 || height <= 0) return img.src;

  const { maxDimension, jpegQuality, forceJpeg, preferWebp } = embedLimits(options);
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  const keepAlpha =
    !forceJpeg &&
    (preferWebp ||
      img.src.includes(".png") ||
      img.src.startsWith("data:image/png") ||
      img.src.includes("image/png") ||
      img.src.includes(".webp"));

  if (!keepAlpha) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, { forceJpeg, jpegQuality, preferWebp, keepAlpha });
}

async function compressBlobToDataUrl(
  blob: Blob,
  options?: ExportImageOptions,
): Promise<string> {
  if (blob.type === "image/svg+xml") {
    return blobToDataUrl(blob);
  }

  const { maxDimension, jpegQuality, forceJpeg, preferWebp } = embedLimits(options);

  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return blobToDataUrl(blob);

      const keepAlpha =
        !forceJpeg &&
        (preferWebp ||
          blob.type === "image/png" ||
          blob.type === "image/webp");

      if (!keepAlpha) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      ctx.drawImage(bitmap, 0, 0, width, height);
      return encodeCanvas(canvas, {
        forceJpeg,
        jpegQuality,
        preferWebp,
        keepAlpha,
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return blobToDataUrl(blob);
  }
}

async function fetchImageAsDataUrl(
  url: string,
  options?: ExportImageOptions,
): Promise<string> {
  const absolute = resolveAbsoluteImageUrl(url);
  if (!absolute) return url;
  if (absolute.startsWith("data:")) return absolute;

  const baseKey =
    options?.deckHandle && isDeckImagePath(absolute)
      ? `deck:${absolute}`
      : absolute;
  const cacheKey = cacheKeyFor(baseKey, options);
  const cached = dataUrlCache.get(cacheKey);
  if (cached) return cached;

  if (options?.deckHandle && isDeckImagePath(absolute)) {
    const blob = await readDeckImageBlob(options.deckHandle, absolute);
    if (blob) {
      const dataUrl = await compressBlobToDataUrl(blob, options);
      dataUrlCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  }

  try {
    const response = await fetch(absolute);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const dataUrl = await compressBlobToDataUrl(blob, options);
    dataUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        void rasterizeImageElement(img, options)
          .then((dataUrl) => {
            dataUrlCache.set(cacheKey, dataUrl);
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
export async function embedImagesForExport(
  root: ParentNode,
  options?: ExportImageOptions,
): Promise<void> {
  const imgTasks: Promise<void>[] = [];

  root.querySelectorAll<HTMLImageElement>("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) return;

    const isSticker = Boolean(img.closest(".slide-sticker-decoration"));
    // Stickers: small WebP with alpha (fast + transparent). Photos: JPEG.
    const imgOptions: ExportImageOptions = isSticker
      ? {
          ...options,
          maxEmbedDimension: Math.min(options?.maxEmbedDimension ?? 480, 480),
          jpegQuality: options?.jpegQuality ?? 0.8,
          forceJpeg: false,
          preferWebp: true,
        }
      : {
          ...options,
          forceJpeg: options?.forceJpeg ?? true,
          preferWebp: false,
        };

    imgTasks.push(
      fetchImageAsDataUrl(src, imgOptions).then((dataUrl) => {
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
      fetchImageAsDataUrl(url, {
        ...options,
        forceJpeg: options?.forceJpeg ?? true,
        preferWebp: false,
      }).then((dataUrl) => {
        if (dataUrl.startsWith("data:")) {
          element.style.backgroundImage = `url("${dataUrl}")`;
        }
      }),
    );
  });

  await Promise.all([...imgTasks, ...bgTasks]);
}

const CSS_URL_PATTERN = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;

function isFontAssetUrl(url: string): boolean {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return (
    path.endsWith(".woff") ||
    path.endsWith(".woff2") ||
    path.endsWith(".ttf") ||
    path.endsWith(".otf") ||
    path.endsWith(".eot") ||
    path.includes("fonts.gstatic.com") ||
    path.includes("fonts.googleapis.com")
  );
}

/** Embed remote asset URLs inside exported CSS so standalone HTML works offline. */
export async function embedUrlsInCss(
  css: string,
  options?: ExportImageOptions & { skipFonts?: boolean },
): Promise<string> {
  const rawUrls = new Set<string>();
  for (const match of css.matchAll(CSS_URL_PATTERN)) {
    const raw = match[2]?.trim();
    if (!raw || raw.startsWith("data:")) continue;
    if (options?.skipFonts && isFontAssetUrl(raw)) continue;
    rawUrls.add(raw);
  }

  const replacements = new Map<string, string>();
  await Promise.all(
    [...rawUrls].map(async (raw) => {
      const dataUrl = await fetchImageAsDataUrl(raw, options);
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
