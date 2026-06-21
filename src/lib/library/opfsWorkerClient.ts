type WorkerResponse =
  | { id: number; ok: true }
  | { id: number; ok: false; error: string };

type WriteTextPayload = { type: "writeText"; path: string[]; content: string };
type WriteBinaryPayload = { type: "writeBinary"; path: string[]; data: ArrayBuffer };
type RemoveDirectoryPayload = {
  type: "removeDirectory";
  parentPath: string[];
  name: string;
};

type WorkerPayload = WriteTextPayload | WriteBinaryPayload | RemoveDirectoryPayload;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./opfsWrite.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) {
        entry.resolve();
      } else {
        entry.reject(new Error(msg.error));
      }
    };
    worker.onerror = (event) => {
      for (const [, entry] of pending) {
        entry.reject(new Error(event.message || "OPFS worker error"));
      }
      pending.clear();
    };
  }
  return worker;
}

function postRequest(payload: WorkerPayload): Promise<void> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...payload, id });
  });
}

export async function opfsWorkerWriteText(
  path: string[],
  content: string,
): Promise<void> {
  await postRequest({ type: "writeText", path, content });
}

export async function opfsWorkerWriteBinary(
  path: string[],
  data: ArrayBuffer,
): Promise<void> {
  await postRequest({ type: "writeBinary", path, data });
}

export async function opfsWorkerRemoveDirectory(
  parentPath: string[],
  name: string,
): Promise<void> {
  await postRequest({ type: "removeDirectory", parentPath, name });
}
