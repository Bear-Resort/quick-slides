import {
  readFileBlob,
  readTextFile,
  writeBinaryFile,
  writeTextFile,
} from "@/lib/library/fsAccess";
import { registerChildHandle } from "@/lib/library/handlePaths";

export type RepoFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: RepoFileEntry[];
};

const IGNORED_NAMES = new Set([".DS_Store", "Thumbs.db"]);

/** Chromium download leftovers and other junk — never show or sync. */
export function isIgnoredRepoName(name: string): boolean {
  if (!name) return true;
  if (IGNORED_NAMES.has(name) || name.startsWith(".")) return true;
  if (name.toLowerCase().endsWith(".crswap")) return true;
  return false;
}

/** Delete leftover `*.crswap` files under a directory tree. */
export async function purgeCrswapFiles(
  dir: FileSystemDirectoryHandle,
): Promise<number> {
  let removed = 0;
  const pendingDirs: FileSystemDirectoryHandle[] = [dir];
  while (pendingDirs.length > 0) {
    const current = pendingDirs.pop()!;
    for await (const [name, handle] of current.entries()) {
      if (handle.kind === "directory") {
        if (isIgnoredRepoName(name)) continue;
        pendingDirs.push(handle as FileSystemDirectoryHandle);
        continue;
      }
      if (name.toLowerCase().endsWith(".crswap")) {
        try {
          await current.removeEntry(name);
          removed += 1;
        } catch {
          // ignore permission / race
        }
      }
    }
  }
  return removed;
}

function splitPath(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  dirPath: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const parts = splitPath(dirPath);
  let current = root;
  for (const part of parts) {
    const next = await current.getDirectoryHandle(part, create ? { create: true } : undefined);
    registerChildHandle(current, next, part);
    current = next;
  }
  return current;
}

export async function resolveParent(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<{ parent: FileSystemDirectoryHandle; name: string }> {
  const parts = splitPath(path);
  if (parts.length === 0) throw new Error("Invalid path");
  const name = parts[parts.length - 1]!;
  const parentPath = parts.slice(0, -1).join("/");
  const parent = await resolveDirectory(root, parentPath);
  return { parent, name };
}

async function buildTree(
  dir: FileSystemDirectoryHandle,
  prefix: string,
): Promise<RepoFileEntry[]> {
  const entries: RepoFileEntry[] = [];
  for await (const [name, handle] of dir.entries()) {
    if (name.toLowerCase().endsWith(".crswap")) {
      try {
        await dir.removeEntry(name);
      } catch {
        // ignore
      }
      continue;
    }
    if (isIgnoredRepoName(name)) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      const dirHandle = handle as FileSystemDirectoryHandle;
      registerChildHandle(dir, dirHandle, name);
      const children = await buildTree(dirHandle, path);
      entries.push({ name, path, isDir: true, children });
    } else {
      entries.push({ name, path, isDir: false });
    }
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

export async function listRepoFileTree(
  root: FileSystemDirectoryHandle,
): Promise<RepoFileEntry[]> {
  await purgeCrswapFiles(root);
  return buildTree(root, "");
}

export async function listRepoFilePaths(
  root: FileSystemDirectoryHandle,
): Promise<string[]> {
  const tree = await listRepoFileTree(root);
  const paths: string[] = [];
  const walk = (entries: RepoFileEntry[]) => {
    for (const entry of entries) {
      if (entry.isDir) {
        if (entry.children) walk(entry.children);
      } else {
        paths.push(entry.path);
      }
    }
  };
  walk(tree);
  return paths;
}

export function isTextPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".md") ||
    lower.endsWith(".json") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".css") ||
    lower.endsWith(".html") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".js") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".jsx")
  );
}

export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".bmp") ||
    lower.endsWith(".avif") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".ico")
  );
}

/** Git blob SHA-1 (`blob <size>\\0` + bytes) — matches GitHub Contents `sha`. */
export async function gitBlobSha(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const header = new TextEncoder().encode(`blob ${body.byteLength}\0`);
  const data = new Uint8Array(header.byteLength + body.byteLength);
  data.set(header, 0);
  data.set(body, header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readRepoTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const { parent, name } = await resolveParent(root, path);
  return readTextFile(parent, name);
}

export async function writeRepoTextFile(
  root: FileSystemDirectoryHandle,
  path: string,
  contents: string,
): Promise<void> {
  const parts = splitPath(path);
  const name = parts.pop();
  if (!name) throw new Error("Invalid path");
  const parent = await resolveDirectory(root, parts.join("/"), true);
  await writeTextFile(parent, name, contents);
}

export async function writeRepoBinaryFile(
  root: FileSystemDirectoryHandle,
  path: string,
  data: Blob | ArrayBuffer,
): Promise<void> {
  const parts = splitPath(path);
  const name = parts.pop();
  if (!name) throw new Error("Invalid path");
  const parent = await resolveDirectory(root, parts.join("/"), true);
  await writeBinaryFile(parent, name, data);
}

export async function createRepoFile(
  root: FileSystemDirectoryHandle,
  path: string,
  contents = "",
): Promise<void> {
  await writeRepoTextFile(root, path, contents);
}

export async function createRepoFolder(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  await resolveDirectory(root, path, true);
}

export async function renameRepoPath(
  root: FileSystemDirectoryHandle,
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (fromPath === toPath) return;
  const { parent: fromParent, name: fromName } = await resolveParent(root, fromPath);
  const toParts = splitPath(toPath);
  const toName = toParts.pop();
  if (!toName) throw new Error("Invalid destination path");
  const toParent = await resolveDirectory(root, toParts.join("/"), true);

  try {
    const file = await fromParent.getFileHandle(fromName);
    const blob = await file.getFile();
    if (isTextPath(fromPath) || isTextPath(toPath)) {
      await writeTextFile(toParent, toName, await blob.text());
    } else {
      await writeBinaryFile(toParent, toName, await blob.arrayBuffer());
    }
    await fromParent.removeEntry(fromName);
    return;
  } catch {
    // directory rename
  }

  const fromDir = await fromParent.getDirectoryHandle(fromName);
  const toDir = await toParent.getDirectoryHandle(toName, { create: true });
  registerChildHandle(toParent, toDir, toName);
  await copyDirectory(fromDir, toDir);
  await fromParent.removeEntry(fromName, { recursive: true });
}

async function copyDirectory(
  from: FileSystemDirectoryHandle,
  to: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, handle] of from.entries()) {
    if (handle.kind === "file") {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      await writeBinaryFile(to, name, buffer);
    } else {
      const child = await to.getDirectoryHandle(name, { create: true });
      registerChildHandle(to, child, name);
      await copyDirectory(handle as FileSystemDirectoryHandle, child);
    }
  }
}

export async function removeRepoPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const { parent, name } = await resolveParent(root, path);
  try {
    await parent.removeEntry(name, { recursive: true });
  } catch {
    await parent.removeEntry(name);
  }
}

export async function readRepoFileBytes(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<ArrayBuffer | null> {
  const { parent, name } = await resolveParent(root, path);
  const blob = await readFileBlob(parent, name);
  if (!blob) return null;
  return blob.arrayBuffer();
}
