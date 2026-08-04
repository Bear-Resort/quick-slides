import {
  DECK_IMAGES_DIR,
  DECK_MARKDOWN_FILE,
  DECK_META_FILE,
  parseDeckMetadata,
  type DeckMetadata,
} from "@/lib/library/deckFormat";
import {
  ensureSubdirectory,
  readFileBlob,
  readJsonFile,
  readTextFile,
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
  type GithubRepo,
} from "@/lib/github/api";

const LINK_KEY = "quick-slides.github.deck-links";

export type DeckGithubLink = {
  owner: string;
  repo: string;
  branch: string;
  fullName: string;
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

export function linkFromRepo(repo: GithubRepo, branch?: string): DeckGithubLink {
  return {
    owner: repo.ownerLogin,
    repo: repo.name,
    branch: branch ?? repo.defaultBranch,
    fullName: repo.fullName,
  };
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

export async function pushDeckToGithub(options: {
  deckId: string;
  deckHandle: FileSystemDirectoryHandle;
  message?: string;
}): Promise<{ commitMessages: string[] }> {
  const link = getDeckGithubLink(options.deckId);
  if (!link) throw new Error("This presentation is not linked to a GitHub repository");

  const message =
    options.message?.trim() ||
    `Update presentation (${new Date().toISOString()})`;

  const markdown = (await readTextFile(options.deckHandle, DECK_MARKDOWN_FILE)) ?? "";
  const metaRaw = await readJsonFile<unknown>(options.deckHandle, DECK_META_FILE);
  const metaText =
    metaRaw !== null
      ? JSON.stringify(metaRaw, null, 2) + "\n"
      : "{}\n";

  const commits: string[] = [];

  const upsertText = async (path: string, text: string) => {
    const existing = await getFileContent(link.owner, link.repo, path, link.branch);
    await putFile({
      owner: link.owner,
      repo: link.repo,
      path,
      contentBase64: encodeTextAsBase64(text),
      message,
      branch: link.branch,
      sha: existing?.sha,
    });
    commits.push(path);
  };

  await upsertText(DECK_MARKDOWN_FILE, markdown);
  await upsertText(DECK_META_FILE, metaText);

  const localImages = await listLocalImageNames(options.deckHandle);
  const remoteImages = await listDirectory(
    link.owner,
    link.repo,
    DECK_IMAGES_DIR,
    link.branch,
  );
  const remoteByName = new Map(
    remoteImages.filter((f) => f.type === "file").map((f) => [f.name, f]),
  );

  const imagesDir = await ensureSubdirectory(options.deckHandle, DECK_IMAGES_DIR);
  for (const name of localImages) {
    const blob = await readFileBlob(imagesDir, name);
    if (!blob) continue;
    const buffer = await blob.arrayBuffer();
    const path = `${DECK_IMAGES_DIR}/${name}`;
    const existing = remoteByName.get(name);
    await putFile({
      owner: link.owner,
      repo: link.repo,
      path,
      contentBase64: encodeBytesAsBase64(buffer),
      message,
      branch: link.branch,
      sha: existing?.sha,
    });
    commits.push(path);
    remoteByName.delete(name);
  }

  for (const leftover of remoteByName.values()) {
    await deleteFile({
      owner: link.owner,
      repo: link.repo,
      path: leftover.path,
      message: `${message} (remove ${leftover.name})`,
      branch: link.branch,
      sha: leftover.sha,
    });
    commits.push(`delete:${leftover.path}`);
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

  const mdFile = await getFileContent(
    link.owner,
    link.repo,
    DECK_MARKDOWN_FILE,
    link.branch,
  );
  if (!mdFile?.content) {
    throw new Error("Remote repository has no deck.md");
  }
  const markdown = decodeBase64ToText(mdFile.content);

  const metaFile = await getFileContent(
    link.owner,
    link.repo,
    DECK_META_FILE,
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

  await writeTextFile(options.deckHandle, DECK_MARKDOWN_FILE, markdown);
  await writeJsonFile(options.deckHandle, DECK_META_FILE, metadata);

  const imagesDir = await ensureSubdirectory(options.deckHandle, DECK_IMAGES_DIR);
  const remoteImages = await listDirectory(
    link.owner,
    link.repo,
    DECK_IMAGES_DIR,
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
    await writeBinaryFile(
      imagesDir,
      file.name,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
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
