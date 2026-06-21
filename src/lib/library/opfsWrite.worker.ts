/// <reference lib="webworker" />

type WriteTextRequest = {
  id: number;
  type: "writeText";
  path: string[];
  content: string;
};

type WriteBinaryRequest = {
  id: number;
  type: "writeBinary";
  path: string[];
  data: ArrayBuffer;
};

type RemoveDirectoryRequest = {
  id: number;
  type: "removeDirectory";
  parentPath: string[];
  name: string;
};

type WorkerRequest = WriteTextRequest | WriteBinaryRequest | RemoveDirectoryRequest;

type WorkerResponse =
  | { id: number; ok: true }
  | { id: number; ok: false; error: string };

async function resolveDirectory(
  segments: string[],
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let dir = await navigator.storage.getDirectory();
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, create ? { create: true } : undefined);
  }
  return dir;
}

async function writeText(path: string[], content: string): Promise<void> {
  const fileName = path[path.length - 1];
  const dirSegments = path.slice(0, -1);
  const dir = await resolveDirectory(dirSegments, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const accessHandle = await fileHandle.createSyncAccessHandle();
  try {
    const data = new TextEncoder().encode(content);
    accessHandle.truncate(0);
    accessHandle.write(data, { at: 0 });
    accessHandle.flush();
  } finally {
    accessHandle.close();
  }
}

async function writeBinary(path: string[], data: ArrayBuffer): Promise<void> {
  const fileName = path[path.length - 1];
  const dirSegments = path.slice(0, -1);
  const dir = await resolveDirectory(dirSegments, true);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const accessHandle = await fileHandle.createSyncAccessHandle();
  try {
    accessHandle.truncate(0);
    accessHandle.write(new Uint8Array(data), { at: 0 });
    accessHandle.flush();
  } finally {
    accessHandle.close();
  }
}

async function removeDirectory(parentPath: string[], name: string): Promise<void> {
  const parent = await resolveDirectory(parentPath);
  try {
    await parent.removeEntry(name, { recursive: true });
    return;
  } catch {
    // Fallback for engines without recursive removeEntry.
  }

  const target = await parent.getDirectoryHandle(name);
  for await (const [entryName, handle] of target.entries()) {
    if (handle.kind === "directory") {
      await removeDirectory([...parentPath, name], entryName);
    } else {
      await target.removeEntry(entryName);
    }
  }
  await parent.removeEntry(name);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  void (async () => {
    try {
      switch (msg.type) {
        case "writeText":
          await writeText(msg.path, msg.content);
          break;
        case "writeBinary":
          await writeBinary(msg.path, msg.data);
          break;
        case "removeDirectory":
          await removeDirectory(msg.parentPath, msg.name);
          break;
      }
      const response: WorkerResponse = { id: msg.id, ok: true };
      self.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        id: msg.id,
        ok: false,
        error: error instanceof Error ? error.message : "OPFS worker failed",
      };
      self.postMessage(response);
    }
  })();
};
