import type { LibraryIndexEntry } from "@/lib/library/deckFormat";
import { needsOpfsWorkerWrites } from "@/lib/library/fsAccess";
import { getHandlePath, registerHandlePath } from "@/lib/library/handlePaths";
import { DEFAULT_LIBRARY_DIR_NAME } from "@/lib/library/libraryPaths";

const DB_NAME = "quick-slides-library";
const DB_VERSION = 1;
const ROOT_STORE = "root";
const INDEX_STORE = "index";

/**
 * Safari cannot structured-clone OPFS FileSystemDirectoryHandle into IndexedDB
 * (DataCloneError: "The object can not be cloned."). Chromium can. Persist a
 * path marker on Safari and re-resolve via navigator.storage.getDirectory().
 */
type RootRecord =
  | { id: "library-root"; kind: "opfs"; path: string[] }
  | { id: "library-root"; kind: "handle"; handle: FileSystemDirectoryHandle }
  /** Legacy Chromium records written before `kind` existed. */
  | { id: "library-root"; handle: FileSystemDirectoryHandle };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ROOT_STORE)) {
        db.createObjectStore(ROOT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        db.createObjectStore(INDEX_STORE, { keyPath: "folderName" });
      }
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => resolve(request.result);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

function isDataCloneError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "DataCloneError" ||
    /can not be cloned|could not be cloned|cannot be cloned/i.test(message)
  );
}

async function resolveOpfsPath(path: string[]): Promise<FileSystemDirectoryHandle | null> {
  if (
    typeof navigator === "undefined" ||
    !("storage" in navigator) ||
    typeof navigator.storage.getDirectory !== "function"
  ) {
    return null;
  }
  const segments = path.length > 0 ? path : [DEFAULT_LIBRARY_DIR_NAME];
  try {
    let dir = await navigator.storage.getDirectory();
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    registerHandlePath(dir, segments);
    return dir;
  } catch {
    return null;
  }
}

async function putRootRecord(record: RootRecord): Promise<void> {
  await withStore(ROOT_STORE, "readwrite", (store) => store.put(record));
}

export async function saveLibraryRootHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const path = getHandlePath(handle) ?? [handle.name || DEFAULT_LIBRARY_DIR_NAME];

  // Safari OPFS: never attempt to IDB-clone the handle.
  if (needsOpfsWorkerWrites()) {
    await putRootRecord({ id: "library-root", kind: "opfs", path });
    return;
  }

  try {
    await putRootRecord({ id: "library-root", kind: "handle", handle });
  } catch (error) {
    if (!isDataCloneError(error)) throw error;
    // Fallback for engines that reject handle cloning (some WebKit builds).
    await putRootRecord({ id: "library-root", kind: "opfs", path });
  }
}

export async function loadLibraryRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const record = await withStore<RootRecord | undefined>(ROOT_STORE, "readonly", (store) =>
    store.get("library-root"),
  );
  if (!record) return null;

  if ("kind" in record && record.kind === "opfs") {
    return resolveOpfsPath(record.path);
  }

  const handle =
    "handle" in record && record.handle
      ? record.handle
      : null;
  if (!handle) {
    return resolveOpfsPath([DEFAULT_LIBRARY_DIR_NAME]);
  }

  // Legacy / Chromium handle — if WebKit left a broken stored handle, recover via OPFS.
  if (needsOpfsWorkerWrites()) {
    const path = getHandlePath(handle) ?? [handle.name || DEFAULT_LIBRARY_DIR_NAME];
    return resolveOpfsPath(path);
  }

  return handle;
}

export async function clearLibraryRootHandle(): Promise<void> {
  await withStore(ROOT_STORE, "readwrite", (store) => store.delete("library-root"));
}

export async function saveLibraryIndex(entries: LibraryIndexEntry[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(INDEX_STORE, "readwrite");
    const store = tx.objectStore(INDEX_STORE);
    store.clear();
    for (const entry of entries) {
      store.put(entry);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

export async function loadLibraryIndex(): Promise<LibraryIndexEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(INDEX_STORE, "readonly");
    const store = tx.objectStore(INDEX_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => {
      resolve((request.result as LibraryIndexEntry[]) ?? []);
      db.close();
    };
  });
}

export async function upsertLibraryIndexEntry(entry: LibraryIndexEntry): Promise<void> {
  await withStore(INDEX_STORE, "readwrite", (store) => store.put(entry));
}

export async function removeLibraryIndexEntry(folderName: string): Promise<void> {
  await withStore(INDEX_STORE, "readwrite", (store) => store.delete(folderName));
}
