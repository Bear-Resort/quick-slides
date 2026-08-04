import { getHandlePath, registerChildHandle, registerHandlePath } from "@/lib/library/handlePaths";
import {
  opfsWorkerRemoveDirectory,
  opfsWorkerWriteBinary,
  opfsWorkerWriteText,
} from "@/lib/library/opfsWorkerClient";
import {
  CUSTOM_LIBRARY_PICKER_ID,
  DEFAULT_LIBRARY_DIR_NAME,
  LIBRARY_PICKER_ID,
} from "@/lib/library/libraryPaths";

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window &&
    typeof indexedDB !== "undefined"
  );
}

export function isDiskFolderPickerSupported(): boolean {
  return isFileSystemAccessSupported();
}

export function isOriginPrivateFilesystemSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  );
}

let createWritableSupported: boolean | undefined;

/** Safari exposes OPFS but not FileSystemFileHandle.createWritable on the main thread. */
export function isCreateWritableSupported(): boolean {
  if (createWritableSupported !== undefined) return createWritableSupported;
  createWritableSupported =
    typeof FileSystemFileHandle !== "undefined" &&
    "createWritable" in FileSystemFileHandle.prototype;
  return createWritableSupported;
}

export function needsOpfsWorkerWrites(): boolean {
  return isOriginPrivateFilesystemSupported() && !isCreateWritableSupported();
}

/** OPFS + IndexedDB — enough for the default one-click library (incl. Safari). */
export function isLibrarySupported(): boolean {
  return (
    typeof indexedDB !== "undefined" &&
    (isOriginPrivateFilesystemSupported() || isFileSystemAccessSupported())
  );
}

/** Create ~/qs-slides without a folder picker (browser-managed OPFS storage). */
export async function createAutoDefaultLibraryRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!isOriginPrivateFilesystemSupported()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getDirectoryHandle(DEFAULT_LIBRARY_DIR_NAME, { create: true });
    registerHandlePath(handle, [DEFAULT_LIBRARY_DIR_NAME]);
    return handle;
  } catch {
    return null;
  }
}

export function registerLibraryRootPath(handle: FileSystemDirectoryHandle): void {
  if (handle.name === DEFAULT_LIBRARY_DIR_NAME) {
    registerHandlePath(handle, [DEFAULT_LIBRARY_DIR_NAME]);
    return;
  }
  registerHandlePath(handle, [handle.name]);
}

export async function pickDefaultLibraryRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const picked = await window.showDirectoryPicker({
      mode: "readwrite",
      id: LIBRARY_PICKER_ID,
      startIn: "documents",
    });
    if (picked.name === DEFAULT_LIBRARY_DIR_NAME) {
      registerLibraryRootPath(picked);
      return picked;
    }
    const handle = await picked.getDirectoryHandle(DEFAULT_LIBRARY_DIR_NAME, { create: true });
    registerHandlePath(handle, [DEFAULT_LIBRARY_DIR_NAME]);
    return handle;
  } catch {
    return null;
  }
}

export async function pickCustomLibraryRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
      id: CUSTOM_LIBRARY_PICKER_ID,
    });
    registerLibraryRootPath(handle);
    return handle;
  } catch {
    return null;
  }
}

/** @deprecated Use pickDefaultLibraryRoot or pickCustomLibraryRoot */
export async function pickLibraryRoot(): Promise<FileSystemDirectoryHandle | null> {
  return pickDefaultLibraryRoot();
}

/**
 * Disk folder picks need readwrite permission; OPFS does not use that model.
 * requestPermission also fails after an await (lost user activation), so we
 * probe the handle when the permission API throws or denies without a prompt.
 */
export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };

  if (typeof handle.queryPermission === "function") {
    try {
      const state = await handle.queryPermission(opts);
      if (state === "granted") return true;
    } catch {
      // OPFS / engines without a permission model
      return true;
    }
  } else {
    return true;
  }

  if (typeof handle.requestPermission === "function") {
    try {
      if ((await handle.requestPermission(opts)) === "granted") {
        return true;
      }
    } catch {
      // Fall through to a probe — common when user activation was lost.
    }
  }

  try {
    const probe = `.qs-perm-${crypto.randomUUID().slice(0, 8)}`;
    await handle.getDirectoryHandle(probe, { create: true });
    await handle.removeEntry(probe).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string | null> {
  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

async function writeTextViaWorker(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  contents: string,
): Promise<void> {
  const dirPath = getHandlePath(dir);
  if (!dirPath) {
    throw new Error("Missing directory path for OPFS write");
  }
  await opfsWorkerWriteText([...dirPath, fileName], contents);
}

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  contents: string,
): Promise<void> {
  if (needsOpfsWorkerWrites()) {
    await writeTextViaWorker(dir, fileName, contents);
    return;
  }

  try {
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    if (!isOriginPrivateFilesystemSupported() || !getHandlePath(dir)) {
      throw error;
    }
    await writeTextViaWorker(dir, fileName, contents);
  }
}

export async function readJsonFile<T>(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<T | null> {
  const text = await readTextFile(dir, fileName);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  value: unknown,
): Promise<void> {
  await writeTextFile(dir, fileName, `${JSON.stringify(value, null, 2)}\n`);
}

export async function ensureSubdirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  const child = await dir.getDirectoryHandle(name, { create: true });
  registerChildHandle(dir, child, name);
  return child;
}

export async function removeDirectoryRecursive(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  if (needsOpfsWorkerWrites()) {
    const parentPath = getHandlePath(parent);
    if (!parentPath) {
      throw new Error("Missing directory path for OPFS delete");
    }
    await opfsWorkerRemoveDirectory(parentPath, name);
    return;
  }

  await parent.removeEntry(name, { recursive: true });
}

export async function listSubdirectoryNames(
  dir: FileSystemDirectoryHandle,
): Promise<string[]> {
  const names: string[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory") {
      names.push(name);
    }
  }
  return names;
}

async function writeBinaryViaWorker(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  data: Blob | ArrayBuffer,
): Promise<void> {
  const dirPath = getHandlePath(dir);
  if (!dirPath) {
    throw new Error("Missing directory path for OPFS write");
  }
  const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
  await opfsWorkerWriteBinary([...dirPath, fileName], buffer);
}

export async function writeBinaryFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  data: Blob | ArrayBuffer,
): Promise<void> {
  if (needsOpfsWorkerWrites()) {
    await writeBinaryViaWorker(dir, fileName, data);
    return;
  }

  try {
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (error) {
    if (!isOriginPrivateFilesystemSupported() || !getHandlePath(dir)) {
      throw error;
    }
    await writeBinaryViaWorker(dir, fileName, data);
  }
}

export async function readFileBlob(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<Blob | null> {
  try {
    const handle = await dir.getFileHandle(fileName);
    return await handle.getFile();
  } catch {
    return null;
  }
}
