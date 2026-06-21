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

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (typeof handle.queryPermission !== "function") {
    return true;
  }
  const opts = { mode: "readwrite" as const };
  if ((await handle.queryPermission(opts)) === "granted") {
    return true;
  }
  if (typeof handle.requestPermission !== "function") {
    return true;
  }
  return (await handle.requestPermission(opts)) === "granted";
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

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  contents: string,
): Promise<void> {
  if (needsOpfsWorkerWrites()) {
    const dirPath = getHandlePath(dir);
    if (!dirPath) {
      throw new Error("Missing directory path for OPFS write");
    }
    await opfsWorkerWriteText([...dirPath, fileName], contents);
    return;
  }

  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
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

export async function writeBinaryFile(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  data: Blob | ArrayBuffer,
): Promise<void> {
  if (needsOpfsWorkerWrites()) {
    const dirPath = getHandlePath(dir);
    if (!dirPath) {
      throw new Error("Missing directory path for OPFS write");
    }
    const buffer = data instanceof ArrayBuffer ? data : await data.arrayBuffer();
    await opfsWorkerWriteBinary([...dirPath, fileName], buffer);
    return;
  }

  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
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
