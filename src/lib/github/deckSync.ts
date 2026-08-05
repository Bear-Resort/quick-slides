import {
  createDeckMetadata,
  DECK_MARKDOWN_FILE,
  DECK_META_FILE,
  parseDeckMetadata,
  serializeDeckMetadata,
  type DeckMetadata,
} from "@/lib/library/deckFormat";
import { readTextFile, writeJsonFile } from "@/lib/library/fsAccess";
import {
  decodeBase64ToBytes,
  decodeBase64ToText,
  deleteFile,
  encodeBytesAsBase64,
  encodeTextAsBase64,
  getFileContent,
  getRepo,
  putFile,
  SHARED_LIBRARY_REPO_NAME,
  type GithubRepo,
} from "@/lib/github/api";

const LINK_KEY = "quick-slides.github.deck-links";

export type DeckGithubLink = {
  owner: string;
  repo: string;
  branch: string;
  fullName: string;
  /**
   * When set, deck files live under this folder in the repo
   * (used by the shared `quick-slide` library). Empty = repo root.
   */
  pathPrefix?: string;
};

type LinkMap = Record<string, DeckGithubLink>;

function readLinkMap(): LinkMap {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LinkMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLinkMap(map: LinkMap): void {
  localStorage.setItem(LINK_KEY, JSON.stringify(map));
}

export function getDeckGithubLink(deckId: string): DeckGithubLink | null {
  return readLinkMap()[deckId] ?? null;
}

export function setDeckGithubLink(deckId: string, link: DeckGithubLink): void {
  const map = readLinkMap();
  map[deckId] = link;
  writeLinkMap(map);
}

export function clearDeckGithubLink(deckId: string): void {
  const map = readLinkMap();
  delete map[deckId];
  writeLinkMap(map);
}

export function listDeckGithubLinks(): Array<{ deckId: string; link: DeckGithubLink }> {
  return Object.entries(readLinkMap()).map(([deckId, link]) => ({ deckId, link }));
}

export function formatDeckGithubLinkLabel(link: DeckGithubLink): string {
  const prefix = link.pathPrefix?.trim();
  return prefix ? `${link.fullName}/${prefix}` : link.fullName;
}

export function isSharedLibraryRepo(repo: Pick<GithubRepo, "name"> | DeckGithubLink): boolean {
  const name = "name" in repo ? repo.name : repo.repo;
  return name === SHARED_LIBRARY_REPO_NAME;
}

export function linkFromRepo(
  repo: GithubRepo,
  options?: { branch?: string; pathPrefix?: string },
): DeckGithubLink {
  const pathPrefix = options?.pathPrefix?.trim() || undefined;
  return {
    owner: repo.ownerLogin,
    repo: repo.name,
    branch: options?.branch ?? repo.defaultBranch,
    fullName: repo.fullName,
    ...(pathPrefix ? { pathPrefix } : {}),
  };
}

/** Dedicated repo = files at root; shared `quick-slide` = files under deck folder. */
export function linkForDeckRepo(repo: GithubRepo, deckId: string): DeckGithubLink {
  if (isSharedLibraryRepo(repo)) {
    return linkFromRepo(repo, { pathPrefix: deckId });
  }
  return linkFromRepo(repo);
}

function remotePath(link: DeckGithubLink, relative: string): string {
  const prefix = link.pathPrefix?.trim();
  if (!prefix) return relative;
  if (!relative) return prefix.replace(/\/+$/, "");
  return `${prefix.replace(/\/+$/, "")}/${relative}`;
}

export function deckRemotePath(link: DeckGithubLink, relative: string): string {
  return remotePath(link, relative);
}

/** e.g. "Content update at 080526 1305" */
export function formatContentUpdateMessage(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `Content update at ${mm}${dd}${yy} ${hh}${min}`;
}

export class PushConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushConflictError";
  }
}

function looksLikeConflict(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /409|422|sha|does not match|conflict|not found|422/i.test(text);
}

async function putFileWithOptionalForce(options: {
  owner: string;
  repo: string;
  path: string;
  contentBase64: string;
  message: string;
  branch: string;
  sha?: string;
  force?: boolean;
}): Promise<void> {
  try {
    await putFile({
      owner: options.owner,
      repo: options.repo,
      path: options.path,
      contentBase64: options.contentBase64,
      message: options.message,
      branch: options.branch,
      sha: options.sha,
    });
  } catch (error) {
    if (!options.force || !looksLikeConflict(error)) {
      if (looksLikeConflict(error)) {
        throw new PushConflictError(
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
    const latest = await getFileContent(
      options.owner,
      options.repo,
      options.path,
      options.branch,
    );
    await putFile({
      owner: options.owner,
      repo: options.repo,
      path: options.path,
      contentBase64: options.contentBase64,
      message: options.message,
      branch: options.branch,
      sha: latest?.sha,
    });
  }
}

export async function pushDeckToGithub(options: {
  deckId: string;
  deckHandle: FileSystemDirectoryHandle;
  message?: string;
  /** When set, only these relative paths are pushed (plus deletions for staged deletes). */
  paths?: string[];
  /** Overwrite remote on SHA / conflict errors (keep local). */
  force?: boolean;
}): Promise<{ commitMessages: string[] }> {
  const link = getDeckGithubLink(options.deckId);
  if (!link) throw new Error("This presentation is not linked to a GitHub repository");

  const {
    isTextPath,
    listRepoFilePaths,
    purgeCrswapFiles,
    readRepoFileBytes,
    readRepoTextFile,
  } = await import("@/lib/github/workingTree");
  await purgeCrswapFiles(options.deckHandle);

  const message =
    options.message?.trim() || formatContentUpdateMessage();

  const { listRemoteDeckFiles } = await import("@/lib/github/scmStatus");

  const localPaths = options.paths?.length
    ? options.paths.filter((p) => !p.toLowerCase().endsWith(".crswap"))
    : await listRepoFilePaths(options.deckHandle);
  const remoteFiles = await listRemoteDeckFiles(link);
  const commits: string[] = [];

  for (const relative of localPaths) {
    if (relative.toLowerCase().endsWith(".crswap")) continue;
    const path = remotePath(link, relative);
    if (isTextPath(relative)) {
      const text = (await readRepoTextFile(options.deckHandle, relative)) ?? "";
      const existing = await getFileContent(link.owner, link.repo, path, link.branch);
      await putFileWithOptionalForce({
        owner: link.owner,
        repo: link.repo,
        path,
        contentBase64: encodeTextAsBase64(text),
        message,
        branch: link.branch,
        sha: existing?.sha,
        force: options.force,
      });
      commits.push(path);
    } else {
      const buffer = await readRepoFileBytes(options.deckHandle, relative);
      if (!buffer) continue;
      const existing = await getFileContent(link.owner, link.repo, path, link.branch);
      await putFileWithOptionalForce({
        owner: link.owner,
        repo: link.repo,
        path,
        contentBase64: encodeBytesAsBase64(buffer),
        message,
        branch: link.branch,
        sha: existing?.sha,
        force: options.force,
      });
      commits.push(path);
    }
    remoteFiles.delete(relative);
  }

  // Only delete remotes when doing a full push (no path filter), matching prior image cleanup
  if (!options.paths) {
    for (const [relative, leftover] of remoteFiles) {
      if (leftover.name.toLowerCase().endsWith(".crswap")) {
        try {
          await deleteFile({
            owner: link.owner,
            repo: link.repo,
            path: leftover.path,
            message: `${message} (remove ${leftover.name})`,
            branch: link.branch,
            sha: leftover.sha,
          });
        } catch {
          // ignore remote crswap cleanup failures
        }
        remoteFiles.delete(relative);
        continue;
      }
      try {
        await deleteFile({
          owner: link.owner,
          repo: link.repo,
          path: leftover.path,
          message: `${message} (remove ${leftover.name})`,
          branch: link.branch,
          sha: leftover.sha,
        });
        commits.push(`delete:${leftover.path}`);
      } catch (error) {
        if (options.force && looksLikeConflict(error)) {
          const latest = await getFileContent(
            link.owner,
            link.repo,
            leftover.path,
            link.branch,
          );
          if (latest?.sha) {
            await deleteFile({
              owner: link.owner,
              repo: link.repo,
              path: leftover.path,
              message: `${message} (remove ${leftover.name})`,
              branch: link.branch,
              sha: latest.sha,
            });
            commits.push(`delete:${leftover.path}`);
          }
        } else if (looksLikeConflict(error)) {
          throw new PushConflictError(
            error instanceof Error ? error.message : String(error),
          );
        } else {
          throw error;
        }
      }
      void relative;
    }
  } else {
    // Staged deletions: path listed but missing locally
    const localSet = new Set(await listRepoFilePaths(options.deckHandle));
    for (const relative of options.paths) {
      if (localSet.has(relative)) continue;
      const existing = remoteFiles.get(relative);
      if (!existing) continue;
      await deleteFile({
        owner: link.owner,
        repo: link.repo,
        path: existing.path,
        message: `${message} (remove ${existing.name})`,
        branch: link.branch,
        sha: existing.sha,
      });
      commits.push(`delete:${existing.path}`);
    }
  }

  return { commitMessages: commits };
}

export type PulledDeck = {
  markdown: string;
  metadata: DeckMetadata;
};

export async function pullDeckFromGithub(options: {
  deckId: string;
  deckHandle: FileSystemDirectoryHandle;
}): Promise<PulledDeck> {
  const link = getDeckGithubLink(options.deckId);
  if (!link) throw new Error("This presentation is not linked to a GitHub repository");

  const {
    isTextPath,
    listRepoFilePaths,
    purgeCrswapFiles,
    removeRepoPath,
    writeRepoBinaryFile,
    writeRepoTextFile,
  } = await import("@/lib/github/workingTree");
  const { listRemoteDeckFiles } = await import("@/lib/github/scmStatus");

  await purgeCrswapFiles(options.deckHandle);

  const remoteFiles = await listRemoteDeckFiles(link);
  if (remoteFiles.size === 0) {
    throw new Error("Remote repository is empty");
  }

  const written = new Set<string>();

  for (const [relative, remote] of remoteFiles) {
    if (relative.toLowerCase().endsWith(".crswap")) continue;
    const file = await getFileContent(
      link.owner,
      link.repo,
      remote.path,
      link.branch,
    );
    if (!file?.content) continue;

    if (isTextPath(relative)) {
      const text = decodeBase64ToText(file.content);
      await writeRepoTextFile(options.deckHandle, relative, text);
    } else {
      const bytes = decodeBase64ToBytes(file.content);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      await writeRepoBinaryFile(options.deckHandle, relative, buffer);
    }
    written.add(relative);
  }

  // Drop local files that are not on the remote (full sync).
  const localPaths = await listRepoFilePaths(options.deckHandle);
  for (const path of localPaths) {
    if (written.has(path)) continue;
    if (path.toLowerCase().endsWith(".crswap")) continue;
    try {
      await removeRepoPath(options.deckHandle, path);
    } catch {
      // ignore cleanup failures
    }
  }

  const metaRaw = await readTextFile(options.deckHandle, DECK_META_FILE);
  let metadata: DeckMetadata | null = null;
  if (metaRaw) {
    try {
      metadata = parseDeckMetadata(JSON.parse(metaRaw));
    } catch {
      metadata = null;
    }
  }
  if (!metadata) {
    metadata = createDeckMetadata(link.repo);
    await writeJsonFile(
      options.deckHandle,
      DECK_META_FILE,
      serializeDeckMetadata(metadata),
    );
  }

  const entryFile = metadata.entryFile || DECK_MARKDOWN_FILE;
  const markdown =
    (await readTextFile(options.deckHandle, entryFile)) ??
    (await readTextFile(options.deckHandle, DECK_MARKDOWN_FILE)) ??
    "";

  return { markdown, metadata };
}

export async function ensureLinkBranch(link: DeckGithubLink): Promise<DeckGithubLink> {
  const repo = await getRepo(link.owner, link.repo);
  if (link.branch) return link;
  return { ...link, branch: repo.defaultBranch, fullName: repo.fullName };
}
