import {
  decodeBase64ToBytes,
  decodeBase64ToText,
  getFileContent,
  listDirectory,
  type GithubContentFile,
} from "@/lib/github/api";
import {
  getDeckGithubLink,
  type DeckGithubLink,
} from "@/lib/github/deckSync";
import {
  isTextPath,
  listRepoFilePaths,
  readRepoFileBytes,
  readRepoTextFile,
  writeRepoBinaryFile,
  writeRepoTextFile,
  type RepoFileEntry,
} from "@/lib/github/workingTree";

export type FileScmKind = "new" | "modified";

export type ScmFileChange = {
  path: string;
  status: "untracked" | "modified" | "deleted";
  staged: boolean;
};

function remotePath(link: DeckGithubLink, relative: string): string {
  const prefix = link.pathPrefix?.trim();
  if (!prefix) return relative;
  return `${prefix.replace(/\/+$/, "")}/${relative}`;
}

async function listRemoteFilesRecursive(
  link: DeckGithubLink,
  dirRelative: string,
): Promise<Map<string, GithubContentFile>> {
  const files = new Map<string, GithubContentFile>();
  const apiPath = dirRelative
    ? remotePath(link, dirRelative)
    : link.pathPrefix?.trim() || "";

  const entries = await listDirectory(
    link.owner,
    link.repo,
    apiPath,
    link.branch,
  );

  for (const entry of entries) {
    const relative = dirRelative ? `${dirRelative}/${entry.name}` : entry.name;
    if (entry.type === "dir") {
      const nested = await listRemoteFilesRecursive(link, relative);
      for (const [path, file] of nested) files.set(path, file);
    } else {
      files.set(relative, entry);
    }
  }

  return files;
}

export async function listRemoteDeckFiles(
  link: DeckGithubLink,
): Promise<Map<string, GithubContentFile>> {
  return listRemoteFilesRecursive(link, "");
}

export async function getRemoteText(
  link: DeckGithubLink,
  relativePath: string,
): Promise<string | null> {
  const file = await getFileContent(
    link.owner,
    link.repo,
    remotePath(link, relativePath),
    link.branch,
  );
  if (!file?.content) return null;
  return decodeBase64ToText(file.content);
}

async function buffersEqual(a: ArrayBuffer, b: ArrayBuffer): Promise<boolean> {
  if (a.byteLength !== b.byteLength) return false;
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  for (let i = 0; i < va.length; i += 1) {
    if (va[i] !== vb[i]) return false;
  }
  return true;
}

export async function computeScmChanges(options: {
  deckId: string;
  deckHandle: FileSystemDirectoryHandle;
  staged: Set<string>;
}): Promise<{
  changes: ScmFileChange[];
  scmByPath: Record<string, FileScmKind>;
}> {
  const link = getDeckGithubLink(options.deckId);
  if (!link) {
    return { changes: [], scmByPath: {} };
  }

  const localPaths = await listRepoFilePaths(options.deckHandle);
  const remoteFiles = await listRemoteDeckFiles(link);
  const changes: ScmFileChange[] = [];
  const scmByPath: Record<string, FileScmKind> = {};

  for (const path of localPaths) {
    const remote = remoteFiles.get(path);
    if (!remote) {
      changes.push({
        path,
        status: "untracked",
        staged: options.staged.has(path),
      });
      scmByPath[path] = "new";
      continue;
    }

    let different = false;
    if (isTextPath(path)) {
      const localText = (await readRepoTextFile(options.deckHandle, path)) ?? "";
      const remoteText = await getRemoteText(link, path);
      different = remoteText === null || remoteText !== localText;
    } else {
      const localBytes = await readRepoFileBytes(options.deckHandle, path);
      const remoteFile = await getFileContent(
        link.owner,
        link.repo,
        remotePath(link, path),
        link.branch,
      );
      if (!localBytes || !remoteFile?.content) {
        different = true;
      } else {
        const remoteBytes = decodeBase64ToBytes(remoteFile.content);
        const buffer = new ArrayBuffer(remoteBytes.byteLength);
        new Uint8Array(buffer).set(remoteBytes);
        different = !(await buffersEqual(localBytes, buffer));
      }
    }

    if (different) {
      changes.push({
        path,
        status: "modified",
        staged: options.staged.has(path),
      });
      scmByPath[path] = "modified";
    }
    remoteFiles.delete(path);
  }

  for (const path of remoteFiles.keys()) {
    changes.push({
      path,
      status: "deleted",
      staged: options.staged.has(path),
    });
  }

  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { changes, scmByPath };
}

export async function revertFileFromRemote(options: {
  deckId: string;
  deckHandle: FileSystemDirectoryHandle;
  path: string;
}): Promise<"restored" | "removed"> {
  const link = getDeckGithubLink(options.deckId);
  if (!link) throw new Error("Not linked to a GitHub repository");

  const remote = await getFileContent(
    link.owner,
    link.repo,
    remotePath(link, options.path),
    link.branch,
  );

  if (!remote?.content) {
    // Untracked locally — delete local file
    const { removeRepoPath } = await import("@/lib/github/workingTree");
    await removeRepoPath(options.deckHandle, options.path);
    return "removed";
  }

  if (isTextPath(options.path)) {
    await writeRepoTextFile(
      options.deckHandle,
      options.path,
      decodeBase64ToText(remote.content),
    );
  } else {
    const bytes = decodeBase64ToBytes(remote.content);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await writeRepoBinaryFile(options.deckHandle, options.path, buffer);
  }
  return "restored";
}

export type { RepoFileEntry };
