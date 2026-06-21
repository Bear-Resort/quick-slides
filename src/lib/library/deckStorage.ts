import {
  createDeckMetadata,
  DECK_IMAGES_DIR,
  DECK_MARKDOWN_FILE,
  DECK_META_FILE,
  generateDeckFolderName,
  metadataToIndexEntry,
  parseDeckMetadata,
  type DeckMetadata,
  type LibraryIndexEntry,
} from "@/lib/library/deckFormat";
import {
  ensureReadWritePermission,
  ensureSubdirectory,
  listSubdirectoryNames,
  readJsonFile,
  readTextFile,
  registerLibraryRootPath,
  removeDirectoryRecursive,
  writeJsonFile,
  writeTextFile,
} from "@/lib/library/fsAccess";
import { registerChildHandle } from "@/lib/library/handlePaths";
import {
  loadLibraryRootHandle,
  removeLibraryIndexEntry,
  saveLibraryRootHandle,
  upsertLibraryIndexEntry,
} from "@/lib/library/handleStore";
import {
  type LibraryPreference,
  setLibraryPreference,
} from "@/lib/library/libraryPreference";
import { getDefaultPresentationFilename } from "@/lib/presentationFilename";
import { getLanguage, type Language } from "@/lib/language";
import type { SlideThemeId } from "@/lib/slideThemes";

export type LoadedDeck = {
  folderName: string;
  handle: FileSystemDirectoryHandle;
  markdown: string;
  metadata: DeckMetadata;
};

export async function connectLibraryRoot(
  handle: FileSystemDirectoryHandle,
  preference: LibraryPreference = "default",
): Promise<boolean> {
  const granted = await ensureReadWritePermission(handle);
  if (!granted) return false;
  registerLibraryRootPath(handle);
  await saveLibraryRootHandle(handle);
  setLibraryPreference(preference);
  return true;
}

export async function getLibraryRoot(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await loadLibraryRootHandle();
  if (!handle) return null;
  const granted = await ensureReadWritePermission(handle);
  if (!granted) return null;
  registerLibraryRootPath(handle);
  return handle;
}

export async function getDeckDirectory(
  root: FileSystemDirectoryHandle,
  folderName: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await root.getDirectoryHandle(folderName);
    registerChildHandle(root, handle, folderName);
    return handle;
  } catch {
    return null;
  }
}

export async function createDeck(
  root: FileSystemDirectoryHandle,
  title: string,
  language: Language = getLanguage(),
): Promise<LoadedDeck> {
  const normalizedTitle = title.trim() || getDefaultPresentationFilename(language);
  const folderName = generateDeckFolderName(normalizedTitle);
  const handle = await root.getDirectoryHandle(folderName, { create: true });
  registerChildHandle(root, handle, folderName);
  await ensureSubdirectory(handle, DECK_IMAGES_DIR);

  const metadata = createDeckMetadata(normalizedTitle);
  const markdown = `# ${normalizedTitle}\n\n---\n\n### First slide\n\n`;

  await writeTextFile(handle, DECK_MARKDOWN_FILE, markdown);
  await writeJsonFile(handle, DECK_META_FILE, metadata);

  const now = new Date().toISOString();
  await upsertLibraryIndexEntry(
    metadataToIndexEntry(folderName, metadata, now),
  );

  return { folderName, handle, markdown, metadata };
}

export async function loadDeck(
  root: FileSystemDirectoryHandle,
  folderName: string,
): Promise<LoadedDeck | null> {
  const handle = await getDeckDirectory(root, folderName);
  if (!handle) return null;

  const markdown = (await readTextFile(handle, DECK_MARKDOWN_FILE)) ?? "";
  const rawMeta = await readJsonFile<unknown>(handle, DECK_META_FILE);
  const metadata = parseDeckMetadata(rawMeta);
  if (!metadata) return null;

  const now = new Date().toISOString();
  await upsertLibraryIndexEntry(metadataToIndexEntry(folderName, metadata, now));

  return { folderName, handle, markdown, metadata };
}

export async function saveDeck(
  handle: FileSystemDirectoryHandle,
  folderName: string,
  markdown: string,
  metadata: DeckMetadata,
): Promise<DeckMetadata> {
  const updated: DeckMetadata = {
    ...metadata,
    updatedAt: new Date().toISOString(),
  };

  await writeTextFile(handle, DECK_MARKDOWN_FILE, markdown);
  await writeJsonFile(handle, DECK_META_FILE, updated);
  await upsertLibraryIndexEntry(metadataToIndexEntry(folderName, updated));

  return updated;
}

export async function updateDeckTitle(
  handle: FileSystemDirectoryHandle,
  folderName: string,
  metadata: DeckMetadata,
  title: string,
): Promise<DeckMetadata> {
  return saveDeck(handle, folderName, await readTextFile(handle, DECK_MARKDOWN_FILE) ?? "", {
    ...metadata,
    title: title.trim() || metadata.title,
  });
}

export async function deleteDeck(
  root: FileSystemDirectoryHandle,
  folderName: string,
): Promise<void> {
  await removeDirectoryRecursive(root, folderName);
  await removeLibraryIndexEntry(folderName);
}

export async function scanLibraryDecks(
  root: FileSystemDirectoryHandle,
): Promise<LibraryIndexEntry[]> {
  const folderNames = await listSubdirectoryNames(root);
  const entries: LibraryIndexEntry[] = [];

  for (const folderName of folderNames) {
    const handle = await getDeckDirectory(root, folderName);
    if (!handle) continue;

    const rawMeta = await readJsonFile<unknown>(handle, DECK_META_FILE);
    const metadata = parseDeckMetadata(rawMeta);
    if (!metadata) continue;

    entries.push(metadataToIndexEntry(folderName, metadata));
  }

  return entries.sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );
}

export async function saveDeckTheme(
  handle: FileSystemDirectoryHandle,
  folderName: string,
  markdown: string,
  metadata: DeckMetadata,
  slideTheme: SlideThemeId,
): Promise<DeckMetadata> {
  return saveDeck(handle, folderName, markdown, { ...metadata, slideTheme });
}
