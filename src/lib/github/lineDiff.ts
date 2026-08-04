export type ScmLineKind = "added" | "modified" | "deleted";

export type ScmLineChange = {
  /** 1-based inclusive */
  startLine: number;
  endLine: number;
  kind: ScmLineKind;
};

type Edit =
  | { type: "equal"; count: number }
  | { type: "insert"; lines: string[] }
  | { type: "delete"; count: number };

/** Myers O(ND) line diff → edit script (a = remote/old, b = local/new). */
function diffLines(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  v.fill(-1);
  v[offset + 1] = 0;
  const trace: Int32Array[] = [];

  outer: for (let d = 0; d <= max; d += 1) {
    const snapshot = new Int32Array(v);
    trace.push(snapshot);
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]!;
      } else {
        x = v[offset + k - 1]! + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }

  const edits: Edit[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d -= 1) {
    const vPrev = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && vPrev[offset + k - 1]! < vPrev[offset + k + 1]!)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vPrev[offset + prevK]!;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      edits.push({ type: "equal", count: 1 });
      x -= 1;
      y -= 1;
    }
    if (d === 0) break;
    if (x === prevX) {
      edits.push({ type: "insert", lines: [b[prevY]!] });
      y = prevY;
    } else {
      edits.push({ type: "delete", count: 1 });
      x = prevX;
    }
  }

  edits.reverse();
  return mergeEdits(edits);
}

function mergeEdits(edits: Edit[]): Edit[] {
  const out: Edit[] = [];
  for (const edit of edits) {
    const last = out[out.length - 1];
    if (!last) {
      out.push(edit);
      continue;
    }
    if (edit.type === "equal" && last.type === "equal") {
      last.count += edit.count;
    } else if (edit.type === "delete" && last.type === "delete") {
      last.count += edit.count;
    } else if (edit.type === "insert" && last.type === "insert") {
      last.lines.push(...edit.lines);
    } else {
      out.push(edit);
    }
  }
  return out;
}

function pushRange(
  ranges: ScmLineChange[],
  start: number,
  end: number,
  kind: ScmLineKind,
): void {
  if (start < 1 || end < start) return;
  const last = ranges[ranges.length - 1];
  if (last && last.kind === kind && last.endLine + 1 >= start) {
    last.endLine = Math.max(last.endLine, end);
    return;
  }
  ranges.push({ startLine: start, endLine: end, kind });
}

/**
 * Compare remote (HEAD) text to local working-tree text.
 * Line numbers are 1-based on the local (new) side.
 */
export function computeLineChanges(
  remoteText: string | null,
  localText: string,
): ScmLineChange[] {
  const localLines = localText.length === 0 ? [] : localText.split("\n");
  if (remoteText === null) {
    if (localLines.length === 0) return [];
    return [
      {
        startLine: 1,
        endLine: localLines.length,
        kind: "added",
      },
    ];
  }

  const remoteLines = remoteText.length === 0 ? [] : remoteText.split("\n");
  if (remoteText === localText) return [];

  const edits = diffLines(remoteLines, localLines);
  const ranges: ScmLineChange[] = [];
  let newLine = 1;

  for (let i = 0; i < edits.length; i += 1) {
    const edit = edits[i]!;
    if (edit.type === "equal") {
      newLine += edit.count;
      continue;
    }
    if (edit.type === "insert") {
      const prev = edits[i - 1];
      const next = edits[i + 1];
      const pairedDelete =
        (prev?.type === "delete" || next?.type === "delete") &&
        edit.lines.length > 0;
      const start = newLine;
      const end = newLine + edit.lines.length - 1;
      pushRange(ranges, start, end, pairedDelete ? "modified" : "added");
      newLine += edit.lines.length;
      continue;
    }
    // delete: marker on the following new-side line (or last line)
    const at = Math.max(1, newLine);
    pushRange(ranges, at, at, "deleted");
  }

  return ranges;
}
