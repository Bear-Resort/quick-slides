import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import { scanLibraryDecks } from "@/lib/library/deckStorage";
import { getLibraryRoot } from "@/lib/library/deckStorage";
import { loadLibraryIndex, saveLibraryIndex } from "@/lib/library/handleStore";

export async function refreshLibraryIndex(): Promise<LibraryIndexEntry[]> {
  const root = await getLibraryRoot();
  if (!root) {
    return loadLibraryIndex();
  }

  const scanned = await scanLibraryDecks(root);
  const cached = await loadLibraryIndex();
  const cachedByFolder = new Map(cached.map((entry) => [entry.folderName, entry]));

  const merged = scanned.map((entry) => {
    const previous = cachedByFolder.get(entry.folderName);
    if (!previous) return entry;
    return {
      ...entry,
      lastOpenedAt: previous.lastOpenedAt,
    };
  });

  merged.sort(
    (a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime(),
  );

  await saveLibraryIndex(merged);
  return merged;
}

export async function getRecentDecks(): Promise<LibraryIndexEntry[]> {
  const root = await getLibraryRoot();
  if (!root) return loadLibraryIndex();
  return refreshLibraryIndex();
}
