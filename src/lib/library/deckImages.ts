import { DECK_IMAGES_DIR, isDeckImagePath } from "@/lib/library/deckFormat";
import {
  ensureSubdirectory,
  readFileBlob,
  writeBinaryFile,
} from "@/lib/library/fsAccess";

const blobUrlCache = new Map<string, string>();

function cacheKey(deckId: string, relativePath: string): string {
  return `${deckId}:${relativePath}`;
}

export function extensionForImageFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  const mime = file.type.toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "png";
}

export async function storeDeckImage(
  deckHandle: FileSystemDirectoryHandle,
  deckId: string,
  file: File,
): Promise<string> {
  const imagesDir = await ensureSubdirectory(deckHandle, DECK_IMAGES_DIR);
  const ext = extensionForImageFile(file);
  const fileName = `${crypto.randomUUID()}.${ext}`;
  await writeBinaryFile(imagesDir, fileName, file);
  const relativePath = `${DECK_IMAGES_DIR}/${fileName}`;
  revokeDeckImageUrl(deckId, relativePath);
  return relativePath;
}

export async function resolveDeckImageSrc(
  deckHandle: FileSystemDirectoryHandle,
  deckId: string,
  src: string,
): Promise<string> {
  if (!isDeckImagePath(src)) return src;

  const key = cacheKey(deckId, src);
  const cached = blobUrlCache.get(key);
  if (cached) return cached;

  const slash = src.indexOf("/");
  if (slash < 0) return "";

  const dirName = src.slice(0, slash);
  const fileName = src.slice(slash + 1);
  if (dirName !== DECK_IMAGES_DIR || !fileName) return "";

  try {
    const imagesDir = await deckHandle.getDirectoryHandle(DECK_IMAGES_DIR);
    const blob = await readFileBlob(imagesDir, fileName);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(key, url);
    return url;
  } catch {
    return "";
  }
}

export function revokeDeckImageUrl(deckId: string, relativePath: string): void {
  const key = cacheKey(deckId, relativePath);
  const url = blobUrlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrlCache.delete(key);
  }
}

export function revokeAllDeckImageUrls(deckId: string): void {
  for (const [key, url] of blobUrlCache.entries()) {
    if (key.startsWith(`${deckId}:`)) {
      URL.revokeObjectURL(url);
      blobUrlCache.delete(key);
    }
  }
}

export async function readDeckImageBlob(
  deckHandle: FileSystemDirectoryHandle,
  src: string,
): Promise<Blob | null> {
  if (!isDeckImagePath(src)) return null;
  const slash = src.indexOf("/");
  const fileName = src.slice(slash + 1);
  try {
    const imagesDir = await deckHandle.getDirectoryHandle(DECK_IMAGES_DIR);
    return readFileBlob(imagesDir, fileName);
  } catch {
    return null;
  }
}

export type DeckImageEntry = {
  relativePath: string;
  fileName: string;
};

function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name);
}

export async function listDeckImages(
  deckHandle: FileSystemDirectoryHandle,
): Promise<DeckImageEntry[]> {
  try {
    const imagesDir = await deckHandle.getDirectoryHandle(DECK_IMAGES_DIR);
    const entries: DeckImageEntry[] = [];
    for await (const [name, handle] of imagesDir.entries()) {
      if (handle.kind !== "file" || !isImageFileName(name)) continue;
      entries.push({
        relativePath: `${DECK_IMAGES_DIR}/${name}`,
        fileName: name,
      });
    }
    return entries.sort((a, b) => a.fileName.localeCompare(b.fileName));
  } catch {
    return [];
  }
}
