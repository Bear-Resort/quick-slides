import type { SlideThemeId } from "@/lib/slideThemes";

export const DECK_MARKDOWN_FILE = "deck.md";
export const DECK_META_FILE = "quick-slides.json";
export const DECK_IMAGES_DIR = "images";
export const DECK_FORMAT_VERSION = 1;

export type DeckMetadata = {
  version: typeof DECK_FORMAT_VERSION;
  title: string;
  slideTheme: SlideThemeId;
  createdAt: string;
  updatedAt: string;
};

export type LibraryIndexEntry = {
  folderName: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

const SLIDE_THEME_IDS = new Set<SlideThemeId>([
  "regular",
  "gray",
  "blue",
  "red",
  "green",
  "purple",
  "bear-academy",
  "the-beauties",
]);

export function isSlideThemeId(value: string): value is SlideThemeId {
  return SLIDE_THEME_IDS.has(value as SlideThemeId);
}

export function slugifyTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "presentation";
}

export function generateDeckFolderName(title: string): string {
  const slug = slugifyTitle(title);
  const suffix = crypto.randomUUID().slice(0, 4);
  return `${slug}-${suffix}`;
}

export function createDeckMetadata(
  title: string,
  slideTheme: SlideThemeId = "regular",
): DeckMetadata {
  const now = new Date().toISOString();
  return {
    version: DECK_FORMAT_VERSION,
    title,
    slideTheme,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseDeckMetadata(raw: unknown): DeckMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const slideTheme =
    typeof record.slideTheme === "string" && isSlideThemeId(record.slideTheme)
      ? record.slideTheme
      : "regular";
  const createdAt =
    typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" ? record.updatedAt : createdAt;

  if (!title) return null;

  return {
    version: DECK_FORMAT_VERSION,
    title,
    slideTheme,
    createdAt,
    updatedAt,
  };
}

export function metadataToIndexEntry(
  folderName: string,
  metadata: DeckMetadata,
  lastOpenedAt?: string,
): LibraryIndexEntry {
  return {
    folderName,
    title: metadata.title,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    lastOpenedAt: lastOpenedAt ?? metadata.updatedAt,
  };
}

export function isDeckImagePath(src: string): boolean {
  return src.startsWith(`${DECK_IMAGES_DIR}/`);
}
