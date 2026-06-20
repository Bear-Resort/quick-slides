import {
  COMMENT_MARKDOWN,
  COMMENT_PLACEHOLDER,
  EQUATION_PLACEHOLDER,
  H1_TITLE_PLACEHOLDER,
  H2_SUBTITLE_PLACEHOLDER,
  H3_PAGE_TITLE_PLACEHOLDER,
  IMAGE_ALT_PLACEHOLDER,
  IMAGE_PLACEHOLDER_MARKDOWN,
  IMAGE_URL_PLACEHOLDER,
  LIST_ITEM_PLACEHOLDER,
  TABLE_CELL_PLACEHOLDER,
  TABLE_HEADER_PLACEHOLDER,
} from "@/lib/editorPlaceholders";
import { splitSlidesWithMeta } from "@/lib/slides";

export type InsertResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const ORDERED_LIST_ITEM_PATTERN = /^\s*(\d+)\.\s+/;

export type InsertTemplate = {
  text: string;
  select?: { start: number; length: number };
};

export function getCursorLineIndex(text: string, cursorPos: number): number {
  return Math.max(0, text.slice(0, cursorPos).split("\n").length - 1);
}

function getLineCharRange(lines: string[], lineIndex: number): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < lineIndex; i++) {
    start += (lines[i]?.length ?? 0) + 1;
  }
  const line = lines[lineIndex] ?? "";
  return { start, end: start + line.length };
}

export function replaceCursorLine(
  value: string,
  cursorPos: number,
  replacement: string,
  selectInReplacement?: { start: number; length: number },
): InsertResult {
  const lines = value.split("\n");
  const lineIndex = getCursorLineIndex(value, cursorPos);
  const { start, end } = getLineCharRange(lines, lineIndex);

  const nextValue = value.slice(0, start) + replacement + value.slice(end);
  const selectionStart = selectInReplacement
    ? start + selectInReplacement.start
    : start + replacement.length;
  const selectionEnd = selectInReplacement
    ? selectionStart + selectInReplacement.length
    : selectionStart;

  return {
    value: nextValue,
    selectionStart,
    selectionEnd,
  };
}

export function insertAtCursor(
  value: string,
  cursorPos: number,
  insertion: string,
  selectInInsertion?: { start: number; length: number },
): InsertResult {
  const nextValue = value.slice(0, cursorPos) + insertion + value.slice(cursorPos);
  const selectionStart = selectInInsertion
    ? cursorPos + selectInInsertion.start
    : cursorPos + insertion.length;
  const selectionEnd = selectInInsertion
    ? selectionStart + selectInInsertion.length
    : selectionStart;

  return {
    value: nextValue,
    selectionStart,
    selectionEnd,
  };
}

export function insertAfterCursorLine(
  value: string,
  cursorPos: number,
  block: string,
  selectInBlock?: { start: number; length: number },
): InsertResult {
  const lines = value.split("\n");
  const lineIndex = getCursorLineIndex(value, cursorPos);
  const { end } = getLineCharRange(lines, lineIndex);
  const prefix = end > 0 && value[end - 1] !== "\n" ? "\n" : "";
  const insertion = `${prefix}${block}`;

  const nextValue = value.slice(0, end) + insertion + value.slice(end);
  const blockStart = end + prefix.length;
  const selectionStart = selectInBlock
    ? blockStart + selectInBlock.start
    : blockStart + block.length;
  const selectionEnd = selectInBlock
    ? selectionStart + selectInBlock.length
    : selectionStart;

  return {
    value: nextValue,
    selectionStart,
    selectionEnd,
  };
}

export type InsertTemplateKey =
  | "h1"
  | "h2"
  | "h3"
  | "separator"
  | "bullet"
  | "orderedList"
  | "mathInline"
  | "mathDisplay"
  | "codeInline"
  | "codeBlock"
  | "comment"
  | "image";

export const INSERT_TEMPLATES: Record<InsertTemplateKey, InsertTemplate> = {
  h1: {
    text: `# ${H1_TITLE_PLACEHOLDER}`,
    select: { start: 2, length: H1_TITLE_PLACEHOLDER.length },
  },
  h2: {
    text: `## ${H2_SUBTITLE_PLACEHOLDER}`,
    select: { start: 3, length: H2_SUBTITLE_PLACEHOLDER.length },
  },
  h3: {
    text: `### ${H3_PAGE_TITLE_PLACEHOLDER}`,
    select: { start: 4, length: H3_PAGE_TITLE_PLACEHOLDER.length },
  },
  separator: { text: "---" },
  bullet: {
    text: `- ${LIST_ITEM_PLACEHOLDER}`,
    select: { start: 2, length: LIST_ITEM_PLACEHOLDER.length },
  },
  orderedList: {
    text: `1. ${LIST_ITEM_PLACEHOLDER}`,
    select: { start: 3, length: LIST_ITEM_PLACEHOLDER.length },
  },
  mathInline: {
    text: `$${EQUATION_PLACEHOLDER}$`,
    select: { start: 1, length: EQUATION_PLACEHOLDER.length },
  },
  mathDisplay: {
    text: `$$\n${EQUATION_PLACEHOLDER}\n$$`,
    select: { start: 3, length: EQUATION_PLACEHOLDER.length },
  },
  codeInline: { text: "`code`", select: { start: 1, length: 4 } },
  codeBlock: { text: "```\ncode\n```", select: { start: 4, length: 4 } },
  comment: {
    text: COMMENT_MARKDOWN,
    select: { start: 5, length: COMMENT_PLACEHOLDER.length },
  },
  image: {
    text: IMAGE_PLACEHOLDER_MARKDOWN,
    select: { start: 2, length: IMAGE_ALT_PLACEHOLDER.length },
  },
};

export type InsertMode = "replace-line" | "at-cursor" | "after-line";

export function getInsertMode(key: InsertTemplateKey): InsertMode {
  switch (key) {
    case "h1":
    case "h2":
    case "h3":
    case "bullet":
      return "replace-line";
    case "separator":
    case "mathDisplay":
    case "codeBlock":
    case "orderedList":
      return "after-line";
    default:
      return "at-cursor";
  }
}

export function getSlideLineRange(
  markdown: string,
  cursorLine: number,
): { startLine: number; endLine: number } {
  const chunks = splitSlidesWithMeta(markdown);
  const totalLines = markdown.split("\n").length;

  for (let i = 0; i < chunks.length; i++) {
    const startLine = chunks[i]?.startLine ?? 0;
    const endLine = i + 1 < chunks.length ? chunks[i + 1]!.markerLine : totalLines;
    if (cursorLine >= startLine && cursorLine < endLine) {
      return { startLine, endLine };
    }
  }

  const last = chunks[chunks.length - 1];
  return last
    ? { startLine: last.startLine, endLine: totalLines }
    : { startLine: 0, endLine: totalLines };
}

function getMaxOrderedListNumber(slideLines: string[]): number {
  let max = 0;
  for (const line of slideLines) {
    const match = line.match(ORDERED_LIST_ITEM_PATTERN);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max;
}

function findOrderedListLineIndices(slideLines: string[]): number[] {
  const indices: number[] = [];
  slideLines.forEach((line, index) => {
    if (ORDERED_LIST_ITEM_PATTERN.test(line)) {
      indices.push(index);
    }
  });
  return indices;
}

export function insertOrderedListItem(value: string, cursorPos: number): InsertResult {
  const lines = value.split("\n");
  const cursorLine = getCursorLineIndex(value, cursorPos);
  const { startLine, endLine } = getSlideLineRange(value, cursorLine);
  const slideLines = lines.slice(startLine, endLine);
  const nextNumber = getMaxOrderedListNumber(slideLines) + 1;
  const itemLine = `${nextNumber}. ${LIST_ITEM_PLACEHOLDER}`;
  const select = {
    start: `${nextNumber}. `.length,
    length: LIST_ITEM_PLACEHOLDER.length,
  };

  const orderedLineIndices = findOrderedListLineIndices(slideLines);
  const currentLine = lines[cursorLine] ?? "";
  const onOrderedLine = ORDERED_LIST_ITEM_PATTERN.test(currentLine);

  if (orderedLineIndices.length === 0) {
    if (currentLine.trim() === "") {
      return replaceCursorLine(value, cursorPos, itemLine, select);
    }
    return insertAfterCursorLine(value, cursorPos, itemLine, select);
  }

  if (onOrderedLine) {
    return insertAfterCursorLine(value, cursorPos, itemLine, select);
  }

  const lastOrderedRel = orderedLineIndices[orderedLineIndices.length - 1] ?? 0;
  const lastOrderedLine = startLine + lastOrderedRel;
  const { end: lastLineEnd } = getLineCharRange(lines, lastOrderedLine);
  return insertAfterCursorLine(value, lastLineEnd, itemLine, select);
}

export function applyInsertTemplate(
  value: string,
  cursorPos: number,
  key: InsertTemplateKey,
): InsertResult {
  if (key === "orderedList") {
    return insertOrderedListItem(value, cursorPos);
  }

  const template = INSERT_TEMPLATES[key];
  const mode = getInsertMode(key);

  if (mode === "replace-line") {
    return replaceCursorLine(value, cursorPos, template.text, template.select);
  }
  if (mode === "after-line") {
    return insertAfterCursorLine(value, cursorPos, template.text, template.select);
  }
  return insertAtCursor(value, cursorPos, template.text, template.select);
}

const TABLE_GRID_DIMENSION = 5;
const MAX_TABLE_DIMENSION = 20;

function clampTableDimension(value: number): number {
  return Math.min(Math.max(value, 1), MAX_TABLE_DIMENSION);
}

export function buildMarkdownTable(rows: number, cols: number): string {
  const rowCount = clampTableDimension(rows);
  const colCount = clampTableDimension(cols);

  const headerCells = Array.from({ length: colCount }, () => TABLE_HEADER_PLACEHOLDER);
  const headerRow = `| ${headerCells.join(" | ")} |`;
  const separatorRow = `| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`;
  const bodyRows = Array.from({ length: Math.max(0, rowCount - 1) }, () =>
    `| ${Array.from({ length: colCount }, () => TABLE_CELL_PLACEHOLDER).join(" | ")} |`,
  );

  return [headerRow, separatorRow, ...bodyRows].join("\n");
}

export function insertTable(
  value: string,
  cursorPos: number,
  rows: number,
  cols: number,
): InsertResult {
  const table = buildMarkdownTable(rows, cols);
  return insertAfterCursorLine(value, cursorPos, table, {
    start: 2,
    length: TABLE_HEADER_PLACEHOLDER.length,
  });
}

export { TABLE_GRID_DIMENSION, MAX_TABLE_DIMENSION };

export type ImageUploadSlot = {
  /** Index of `(` in `![alt](url)` */
  parenStart: number;
  overlayStart: number;
  overlayEnd: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMPTY_IMAGE_PATTERN = new RegExp(
  `!\\[[^\\]]*\\]\\((?:${escapeRegExp(IMAGE_URL_PLACEHOLDER)}|\\s*)\\)`,
  "g",
);

export function findEmptyImageSlots(markdown: string): ImageUploadSlot[] {
  const slots: ImageUploadSlot[] = [];
  for (const match of markdown.matchAll(EMPTY_IMAGE_PATTERN)) {
    const index = match.index;
    if (index === undefined) continue;
    const full = match[0];
    const parenStart = index + full.lastIndexOf("(");
    const closeParen = index + full.length - 1;
    const urlStart = parenStart + 1;
    slots.push({
      parenStart,
      overlayStart: urlStart < closeParen ? urlStart : parenStart,
      overlayEnd: urlStart < closeParen ? closeParen : parenStart + 2,
    });
  }
  return slots;
}

export function fillImageSlot(value: string, parenStart: number, url: string): string {
  const closeParen = value.indexOf(")", parenStart);
  if (closeParen === -1) return value;
  return `${value.slice(0, parenStart + 1)}${url}${value.slice(closeParen)}`;
}

export type CharRangePosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function measureCharRange(
  mirror: HTMLDivElement,
  start: number,
  end: number,
  options?: { minWidth?: number },
): CharRangePosition | null {
  const textNode = mirror.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const length = textNode.textContent?.length ?? 0;
  const safeStart = Math.min(start, length);
  const safeEnd = Math.min(Math.max(end, safeStart + 1), length);

  const range = document.createRange();
  range.setStart(textNode, safeStart);
  range.setEnd(textNode, safeEnd);

  const rect = range.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const minWidth = options?.minWidth ?? 72;

  return {
    top: rect.top - mirrorRect.top,
    left: rect.left - mirrorRect.left,
    width: minWidth > 0 ? Math.max(rect.width, minWidth) : rect.width,
    height: rect.height || parseFloat(getComputedStyle(mirror).lineHeight) || 20,
  };
}
