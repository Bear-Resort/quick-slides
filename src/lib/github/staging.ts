const STAGE_KEY = "quick-slides.github.staged";

type StageMap = Record<string, string[]>;

function readMap(): StageMap {
  try {
    const raw = localStorage.getItem(STAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StageMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: StageMap): void {
  localStorage.setItem(STAGE_KEY, JSON.stringify(map));
}

export function getStagedPaths(deckId: string): Set<string> {
  return new Set(readMap()[deckId] ?? []);
}

export function setStagedPaths(deckId: string, paths: Iterable<string>): void {
  const map = readMap();
  const list = [...new Set(paths)].sort();
  if (list.length === 0) delete map[deckId];
  else map[deckId] = list;
  writeMap(map);
}

export function stagePath(deckId: string, path: string): void {
  const next = getStagedPaths(deckId);
  next.add(path);
  setStagedPaths(deckId, next);
}

export function unstagePath(deckId: string, path: string): void {
  const next = getStagedPaths(deckId);
  next.delete(path);
  setStagedPaths(deckId, next);
}

export function clearStaged(deckId: string): void {
  const map = readMap();
  delete map[deckId];
  writeMap(map);
}

export function stageAll(deckId: string, paths: Iterable<string>): void {
  setStagedPaths(deckId, paths);
}

export function unstageAll(deckId: string): void {
  clearStaged(deckId);
}
