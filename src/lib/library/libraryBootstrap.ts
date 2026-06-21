import { connectLibraryRoot, getLibraryRoot } from "@/lib/library/deckStorage";
import { refreshLibraryIndex } from "@/lib/library/libraryIndex";
import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import { usesBrowserStorageLibrary } from "@/lib/library/browserLibrary";
import { createAutoDefaultLibraryRoot } from "@/lib/library/fsAccess";
import { getLibraryDisplayPath } from "@/lib/library/libraryPaths";

export type LibraryBootstrapResult = {
  connected: boolean;
  root: FileSystemDirectoryHandle | null;
  decks: LibraryIndexEntry[];
  displayPath: string;
  storageMode: "disk" | "browser";
};

/** Try the saved library handle first; auto-create browser storage on Safari/Firefox. */
export async function bootstrapLibrary(): Promise<LibraryBootstrapResult> {
  let root = await getLibraryRoot();

  if (!root && usesBrowserStorageLibrary()) {
    const handle = await createAutoDefaultLibraryRoot();
    if (handle) {
      await connectLibraryRoot(handle, "default");
      root = handle;
    }
  }

  if (!root) {
    return {
      connected: false,
      root: null,
      decks: [],
      displayPath: getLibraryDisplayPath(null),
      storageMode: usesBrowserStorageLibrary() ? "browser" : "disk",
    };
  }

  const decks = await refreshLibraryIndex();
  return {
    connected: true,
    root,
    decks,
    displayPath: getLibraryDisplayPath(root),
    storageMode: usesBrowserStorageLibrary() ? "browser" : "disk",
  };
}
