import type { SlideColorMode, SlideThemeId } from "@/lib/slideThemes";
import { isSlideColorMode, isSlideThemeId } from "@/lib/slideThemes";

export const DECK_MARKDOWN_FILE = "deck.md";
export const DECK_META_FILE = "quick-slides.json";
export const DECK_IMAGES_DIR = "images";
export const DECK_FORMAT_VERSION = 1;

/** Theme + light/dark for one markdown deck file. */
export type FileStyle = {
  theme: SlideThemeId;
  colorMode: SlideColorMode;
};

/** @deprecated Alias for FileStyle — kept for call-site clarity. */
export type SlideStyle = FileStyle;

export type DeckMetadata = {
  version: typeof DECK_FORMAT_VERSION;
  title: string;
  /**
   * Per-markdown-file styles, keyed by path relative to the deck root
   * (e.g. `"deck.md"`, `"talks/intro.md"`).
   */
  fileStyles: Record<string, FileStyle>;
  /** Markdown file used for slide preview / export (last opened .md). */
  entryFile: string;
  createdAt: string;
};

export type LibraryIndexEntry = {
  folderName: string;
  title: string;
  createdAt: string;
  /** Local library index only — not stored in quick-slides.json. */
  updatedAt: string;
  lastOpenedAt: string;
};

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

export function normalizeRepoPath(path: string): string {
  return path.trim().replace(/^\/+/, "");
}

export function createFileStyle(
  theme: SlideThemeId = "regular",
  colorMode: SlideColorMode = "light",
): FileStyle {
  return { theme, colorMode };
}

/** @deprecated Use createFileStyle. */
export const createSlideStyle = createFileStyle;

/** Style for the entry markdown file (fallback: regular / light). */
export function defaultFileStyle(
  metadata: Pick<DeckMetadata, "fileStyles" | "entryFile">,
): FileStyle {
  const entryFile = metadata.entryFile || DECK_MARKDOWN_FILE;
  const entry = metadata.fileStyles?.[entryFile];
  if (!entry) return createFileStyle();
  return {
    theme: isSlideThemeId(entry.theme) ? entry.theme : "regular",
    colorMode: isSlideColorMode(entry.colorMode) ? entry.colorMode : "light",
  };
}

export function resolveFileStyle(
  metadata: Pick<DeckMetadata, "fileStyles" | "entryFile">,
  filePath: string,
): FileStyle {
  const fallback = defaultFileStyle(metadata);
  const path = normalizeRepoPath(filePath);
  const entry = metadata.fileStyles?.[path];
  if (!entry) return fallback;
  return {
    theme: isSlideThemeId(entry.theme) ? entry.theme : fallback.theme,
    colorMode: isSlideColorMode(entry.colorMode) ? entry.colorMode : fallback.colorMode,
  };
}

/** Set style for one markdown file. */
export function withFileStyle(
  metadata: DeckMetadata,
  filePath: string,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
): DeckMetadata {
  const path = normalizeRepoPath(filePath) || DECK_MARKDOWN_FILE;
  const style = createFileStyle(theme, colorMode);
  return {
    ...metadata,
    fileStyles: {
      ...(metadata.fileStyles ?? {}),
      [path]: style,
    },
  };
}

/**
 * Update the entry file's style in fileStyles.
 * Prefer withFileStyle when you know which .md is being styled.
 */
export function withDeckStyle(
  metadata: DeckMetadata,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
): DeckMetadata {
  const entryFile = metadata.entryFile || DECK_MARKDOWN_FILE;
  return withFileStyle(metadata, entryFile, theme, colorMode);
}

/** JSON shape written to quick-slides.json (no legacy duplicate fields). */
export function serializeDeckMetadata(metadata: DeckMetadata): Record<string, unknown> {
  const entryFile = metadata.entryFile || DECK_MARKDOWN_FILE;
  const fileStyles = { ...(metadata.fileStyles ?? {}) };
  if (!fileStyles[entryFile]) {
    fileStyles[entryFile] = createFileStyle();
  }
  return {
    version: DECK_FORMAT_VERSION,
    title: metadata.title,
    fileStyles,
    entryFile,
    createdAt: metadata.createdAt,
  };
}

export function createDeckMetadata(
  title: string,
  theme: SlideThemeId = "regular",
  colorMode: SlideColorMode = "light",
): DeckMetadata {
  const now = new Date().toISOString();
  const style = createFileStyle(theme, colorMode);
  return {
    version: DECK_FORMAT_VERSION,
    title,
    fileStyles: {
      [DECK_MARKDOWN_FILE]: style,
    },
    createdAt: now,
    entryFile: DECK_MARKDOWN_FILE,
  };
}

function parseOneFileStyle(raw: unknown, fallback: FileStyle): FileStyle {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const record = raw as Record<string, unknown>;
  const theme =
    typeof record.theme === "string" && isSlideThemeId(record.theme)
      ? record.theme
      : fallback.theme;
  const colorMode =
    typeof record.colorMode === "string" && isSlideColorMode(record.colorMode)
      ? record.colorMode
      : fallback.colorMode;
  return { theme, colorMode };
}

function parseFileStyles(
  raw: unknown,
  fallback: FileStyle,
  entryFile: string,
): Record<string, FileStyle> {
  const result: Record<string, FileStyle> = {};

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const path = normalizeRepoPath(key);
      if (!path.toLowerCase().endsWith(".md")) continue;
      result[path] = parseOneFileStyle(value, fallback);
    }
  }

  if (!result[entryFile]) {
    result[entryFile] = { ...fallback };
  }

  return result;
}

/** Resolve a default style from legacy top-level fields (slideTheme / style). */
function legacyFallbackStyle(record: Record<string, unknown>): FileStyle {
  const styleRecord =
    record.style && typeof record.style === "object"
      ? (record.style as Record<string, unknown>)
      : null;
  const styleTheme =
    typeof styleRecord?.theme === "string" && isSlideThemeId(styleRecord.theme)
      ? styleRecord.theme
      : null;
  const styleColorMode =
    typeof styleRecord?.colorMode === "string" &&
    isSlideColorMode(styleRecord.colorMode)
      ? styleRecord.colorMode
      : null;

  const theme =
    styleTheme ??
    (typeof record.slideTheme === "string" && isSlideThemeId(record.slideTheme)
      ? record.slideTheme
      : "regular");
  const colorMode =
    styleColorMode ??
    (typeof record.slideColorMode === "string" &&
    isSlideColorMode(record.slideColorMode)
      ? record.slideColorMode
      : "light");
  return createFileStyle(theme, colorMode);
}

export function parseDeckMetadata(raw: unknown): DeckMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;

  const createdAt =
    typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const entryFile =
    typeof record.entryFile === "string" &&
    record.entryFile.trim().toLowerCase().endsWith(".md")
      ? normalizeRepoPath(record.entryFile)
      : DECK_MARKDOWN_FILE;

  const fallback = legacyFallbackStyle(record);
  const fileStyles = parseFileStyles(record.fileStyles, fallback, entryFile);

  return {
    version: DECK_FORMAT_VERSION,
    title,
    fileStyles,
    entryFile,
    createdAt,
  };
}

export function metadataToIndexEntry(
  folderName: string,
  metadata: DeckMetadata,
  lastOpenedAt?: string,
): LibraryIndexEntry {
  const touchedAt = lastOpenedAt ?? new Date().toISOString();
  return {
    folderName,
    title: metadata.title,
    createdAt: metadata.createdAt,
    updatedAt: touchedAt,
    lastOpenedAt: touchedAt,
  };
}

export function isDeckImagePath(src: string): boolean {
  return src.startsWith(`${DECK_IMAGES_DIR}/`);
}
