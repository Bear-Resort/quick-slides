import {
  DECK_IMAGES_DIR,
  DECK_MARKDOWN_FILE,
  DECK_META_FILE,
  parseDeckMetadata,
  serializeDeckMetadata,
  type DeckMetadata,
} from "@/lib/library/deckFormat";
import {
  ensureSubdirectory,
  writeBinaryFile,
  writeJsonFile,
  writeTextFile,
} from "@/lib/library/fsAccess";
import {
  decodeBase64ToBytes,
  decodeBase64ToText,
  deleteFile,
  encodeBytesAsBase64,
  encodeTextAsBase64,
  getFileContent,
  getRepo,
  listDirectory,
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

async function listLocalImageNames(
  deckHandle: FileSystemDirectoryHandle,
): Promise<string[]> {
  try {
    const images = await deckHandle.getDirectoryHandle(DECK_IMAGES_DIR);
    const names: string[] = [];
    for await (const [name, handle] of images.entries()) {
      if (handle.kind === "file") names.push(name);
    }
    return names;
  } catch {
    return [];
  }
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

  const metaFile = await getFileContent(
    link.owner,
    link.repo,
    remotePath(link, DECK_META_FILE),
    link.branch,
  );
  let metadata: DeckMetadata;
  if (metaFile?.content) {
    const parsed = parseDeckMetadata(JSON.parse(decodeBase64ToText(metaFile.content)));
    if (!parsed) throw new Error("Remote quick-slides.json is invalid");
    metadata = parsed;
  } else {
    throw new Error("Remote repository has no quick-slides.json");
  }

  const entryFile = metadata.entryFile || DECK_MARKDOWN_FILE;
  const mdFile = await getFileContent(
    link.owner,
    link.repo,
    remotePath(link, entryFile),
    link.branch,
  );
  if (!mdFile?.content) {
    throw new Error(`Remote repository has no ${entryFile}`);
  }
  const markdown = decodeBase64ToText(mdFile.content);

  await writeTextFile(options.deckHandle, entryFile, markdown);
  await writeJsonFile(
    options.deckHandle,
    DECK_META_FILE,
    serializeDeckMetadata(metadata),
  );

  const imagesDir = await ensureSubdirectory(options.deckHandle, DECK_IMAGES_DIR);
  const remoteImages = await listDirectory(
    link.owner,
    link.repo,
    remotePath(link, DECK_IMAGES_DIR),
    link.branch,
  );
  const remoteNames = new Set<string>();

  for (const file of remoteImages) {
    if (file.type !== "file") continue;
    remoteNames.add(file.name);
    const remote = await getFileContent(
      link.owner,
      link.repo,
      file.path,
      link.branch,
    );
    if (!remote?.content) continue;
    const bytes = decodeBase64ToBytes(remote.content);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    await writeBinaryFile(imagesDir, file.name, buffer);
  }

  const localImages = await listLocalImageNames(options.deckHandle);
  for (const name of localImages) {
    if (remoteNames.has(name)) continue;
    try {
      await imagesDir.removeEntry(name);
    } catch {
      // ignore
    }
  }

  return { markdown, metadata };
}

export async function ensureLinkBranch(link: DeckGithubLink): Promise<DeckGithubLink> {
  const repo = await getRepo(link.owner, link.repo);
  if (link.branch) return link;
  return { ...link, branch: repo.defaultBranch, fullName: repo.fullName };
}
