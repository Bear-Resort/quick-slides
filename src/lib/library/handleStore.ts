import type { LibraryIndexEntry } from "@/lib/library/deckFormat";

const DB_NAME = "quick-slides-library";
const DB_VERSION = 1;
const ROOT_STORE = "root";
const INDEX_STORE = "index";

type RootRecord = {
  id: "library-root";
  handle: FileSystemDirectoryHandle;
};

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

export async function saveLibraryRootHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await withStore(ROOT_STORE, "readwrite", (store) =>
    store.put({ id: "library-root", handle } satisfies RootRecord),
  );
}

export async function loadLibraryRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const record = await withStore<RootRecord | undefined>(ROOT_STORE, "readonly", (store) =>
    store.get("library-root"),
  );
  return record?.handle ?? null;
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
