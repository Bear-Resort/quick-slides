import { ensureBrowserLibraryRoot, getLibraryRoot } from "@/lib/library/deckStorage";
import { refreshLibraryIndex } from "@/lib/library/libraryIndex";
import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import { getLibraryPreference } from "@/lib/library/libraryPreference";
import { getLibraryDisplayPath } from "@/lib/library/libraryPaths";

export type LibraryBootstrapResult = {
  connected: boolean;
  root: FileSystemDirectoryHandle | null;
  decks: LibraryIndexEntry[];
  displayPath: string;
  storageMode: "disk" | "browser";
};

function resolveStorageMode(): "disk" | "browser" {
  return getLibraryPreference() === "custom" ? "disk" : "browser";
}

/** Try the saved library handle first; otherwise auto-create browser (OPFS) storage. */
export async function bootstrapLibrary(): Promise<LibraryBootstrapResult> {
  let root = await getLibraryRoot();

  if (!root || getLibraryPreference() !== "custom") {
    const browserRoot = await ensureBrowserLibraryRoot();
    if (browserRoot) {
      root = browserRoot;
    }
  }

  if (!root) {
    return {
      connected: false,
      root: null,
      decks: [],
      displayPath: getLibraryDisplayPath(null),
      storageMode: "browser",
    };
  }

  const decks = await refreshLibraryIndex();
  return {
    connected: true,
    root,
    decks,
    displayPath: getLibraryDisplayPath(root),
    storageMode: resolveStorageMode(),
  };
}
