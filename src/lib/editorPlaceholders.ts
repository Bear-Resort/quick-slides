/** Editor placeholders — visible in the markdown textarea only. */

export const EDITOR_PLACEHOLDER_LABELS = {
  title: "Title",
  subtitle: "Subtitle",
  pageTitle: "Page title",
  listItem: "item",
  equation: "equation",
  comment: "note",
  header: "Header",
  cell: "Content",
  alt: "Alt",
  url: "Upload",
} as const;

function repeatPlaceholderChar(char: string, label: string): string {
  return char.repeat(label.length);
}

export const H1_TITLE_PLACEHOLDER = repeatPlaceholderChar(
  "◆",
  EDITOR_PLACEHOLDER_LABELS.title,
);
export const H2_SUBTITLE_PLACEHOLDER = repeatPlaceholderChar(
  "◇",
  EDITOR_PLACEHOLDER_LABELS.subtitle,
);
export const H3_PAGE_TITLE_PLACEHOLDER = repeatPlaceholderChar(
  "◈",
  EDITOR_PLACEHOLDER_LABELS.pageTitle,
);
export const LIST_ITEM_PLACEHOLDER = repeatPlaceholderChar(
  "▷",
  EDITOR_PLACEHOLDER_LABELS.listItem,
);
export const EQUATION_PLACEHOLDER = repeatPlaceholderChar(
  "∯",
  EDITOR_PLACEHOLDER_LABELS.equation,
);
export const COMMENT_PLACEHOLDER = repeatPlaceholderChar(
  "▸",
  EDITOR_PLACEHOLDER_LABELS.comment,
);
export const COMMENT_MARKDOWN = `<!-- ${COMMENT_PLACEHOLDER} -->`;

export const TABLE_HEADER_PLACEHOLDER = repeatPlaceholderChar(
  "▣",
  EDITOR_PLACEHOLDER_LABELS.header,
);
export const TABLE_CELL_PLACEHOLDER = repeatPlaceholderChar(
  "▢",
  EDITOR_PLACEHOLDER_LABELS.cell,
);
export const IMAGE_ALT_PLACEHOLDER = repeatPlaceholderChar(
  "▫",
  EDITOR_PLACEHOLDER_LABELS.alt,
);
export const IMAGE_URL_PLACEHOLDER = repeatPlaceholderChar(
  "⬚",
  EDITOR_PLACEHOLDER_LABELS.url,
);

export const IMAGE_PLACEHOLDER_MARKDOWN = `![${IMAGE_ALT_PLACEHOLDER}](${IMAGE_URL_PLACEHOLDER})`;

/** Labels shown in slide preview/present when placeholders are unresolved. */
export const SLIDE_IMAGE_PLACEHOLDER_LABEL = "image";
export const SLIDE_TABLE_CELL_PLACEHOLDER_LABEL = "content";
export const SLIDE_TABLE_HEADER_PLACEHOLDER_LABEL = "Header";
export const SLIDE_EQUATION_PLACEHOLDER = "x";

export type EditorPlaceholderKind =
  | "title"
  | "subtitle"
  | "pageTitle"
  | "listItem"
  | "equation"
  | "comment"
  | "header"
  | "cell"
  | "alt"
  | "url";

export type EditorPlaceholderSlot = {
  start: number;
  end: number;
  kind: EditorPlaceholderKind;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isImagePlaceholderUrl(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.length === 0 || trimmed === IMAGE_URL_PLACEHOLDER;
}

export function isInsideImageAltPlaceholder(markdown: string, index: number): boolean {
  const pattern = new RegExp(`!\\[${escapeRegExp(IMAGE_ALT_PLACEHOLDER)}\\]`, "g");
  for (const match of markdown.matchAll(pattern)) {
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;
    const altStart = matchIndex + 2;
    if (index >= altStart && index < altStart + IMAGE_ALT_PLACEHOLDER.length) {
      return true;
    }
  }
  return false;
}

export function isInsideCommentPlaceholder(markdown: string, index: number): boolean {
  const commentPattern = /<!--[\s\S]*?-->/g;
  for (const match of markdown.matchAll(commentPattern)) {
    const matchIndex = match.index;
    if (matchIndex === undefined) continue;
    const placeholderOffset = match[0].indexOf(COMMENT_PLACEHOLDER);
    if (placeholderOffset === -1) continue;
    const placeholderStart = matchIndex + placeholderOffset;
    if (index >= placeholderStart && index < placeholderStart + COMMENT_PLACEHOLDER.length) {
      return true;
    }
  }
  return false;
}

export function isTableHeaderPlaceholder(text: string): boolean {
  return text.trim() === TABLE_HEADER_PLACEHOLDER;
}

export function isTableCellPlaceholder(text: string): boolean {
  return text.trim() === TABLE_CELL_PLACEHOLDER;
}

export function isImageAltPlaceholder(text: string): boolean {
  return text.trim() === IMAGE_ALT_PLACEHOLDER;
}

export type TableCellSlot = EditorPlaceholderSlot & {
  kind: "header" | "cell";
};

export type ImageAltSlot = EditorPlaceholderSlot & {
  kind: "alt";
};

export const IMAGE_PLACEHOLDER_PATTERN = new RegExp(
  `!\\[${escapeRegExp(IMAGE_ALT_PLACEHOLDER)}\\]\\((?:${escapeRegExp(IMAGE_URL_PLACEHOLDER)}|\\s*)\\)`,
  "g",
);

const PLACEHOLDER_MARKERS: Array<{ text: string; kind: EditorPlaceholderKind }> = [
  { text: H3_PAGE_TITLE_PLACEHOLDER, kind: "pageTitle" },
  { text: H2_SUBTITLE_PLACEHOLDER, kind: "subtitle" },
  { text: EQUATION_PLACEHOLDER, kind: "equation" },
  { text: TABLE_HEADER_PLACEHOLDER, kind: "header" },
  { text: TABLE_CELL_PLACEHOLDER, kind: "cell" },
  { text: COMMENT_PLACEHOLDER, kind: "comment" },
  { text: H1_TITLE_PLACEHOLDER, kind: "title" },
  { text: LIST_ITEM_PLACEHOLDER, kind: "listItem" },
  { text: IMAGE_ALT_PLACEHOLDER, kind: "alt" },
].sort((a, b) => b.text.length - a.text.length) as Array<{
  text: string;
  kind: EditorPlaceholderKind;
}>;

export function findEditorPlaceholderSlots(markdown: string): EditorPlaceholderSlot[] {
  const slots: EditorPlaceholderSlot[] = [];
  const occupied: Array<{ start: number; end: number }> = [];

  for (const marker of PLACEHOLDER_MARKERS) {
    let index = 0;
    while (index < markdown.length) {
      const found = markdown.indexOf(marker.text, index);
      if (found === -1) break;

      const candidate = { start: found, end: found + marker.text.length };

      if (marker.kind === "cell" && isInsideImageAltPlaceholder(markdown, found)) {
        index = found + 1;
        continue;
      }

      if (marker.kind === "alt" && !isInsideImageAltPlaceholder(markdown, found)) {
        index = found + 1;
        continue;
      }

      if (marker.kind === "comment" && !isInsideCommentPlaceholder(markdown, found)) {
        index = found + 1;
        continue;
      }

      if (!occupied.some((range) => rangesOverlap(range, candidate))) {
        slots.push({ ...candidate, kind: marker.kind });
        occupied.push(candidate);
      }

      index = found + marker.text.length;
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

export function findImageAltPlaceholderSlots(markdown: string): ImageAltSlot[] {
  return findEditorPlaceholderSlots(markdown).filter(
    (slot): slot is ImageAltSlot => slot.kind === "alt",
  );
}

export function findTableCellSlots(markdown: string): TableCellSlot[] {
  return findEditorPlaceholderSlots(markdown).filter(
    (slot): slot is TableCellSlot => slot.kind === "header" || slot.kind === "cell",
  );
}

function replaceTableCellPlaceholders(markdown: string, label: string): string {
  let result = markdown;
  let index = 0;
  while (index < result.length) {
    const found = result.indexOf(TABLE_CELL_PLACEHOLDER, index);
    if (found === -1) break;

    if (isInsideImageAltPlaceholder(result, found)) {
      index = found + 1;
      continue;
    }

    result =
      result.slice(0, found) +
      label +
      result.slice(found + TABLE_CELL_PLACEHOLDER.length);
    index = found + label.length;
  }
  return result;
}

/** Replace editor placeholders with slide-friendly text for preview/present. */
export function resolvePlaceholdersForSlide(markdown: string): string {
  let result = markdown;

  result = result.replace(
    new RegExp(
      `!\\[${escapeRegExp(IMAGE_ALT_PLACEHOLDER)}\\]\\(${escapeRegExp(IMAGE_URL_PLACEHOLDER)}\\)`,
      "g",
    ),
    `![${SLIDE_IMAGE_PLACEHOLDER_LABEL}]()`,
  );

  const replacements: Array<{ text: string; value: string }> = [
    { text: H3_PAGE_TITLE_PLACEHOLDER, value: EDITOR_PLACEHOLDER_LABELS.pageTitle },
    { text: H2_SUBTITLE_PLACEHOLDER, value: EDITOR_PLACEHOLDER_LABELS.subtitle },
    { text: H1_TITLE_PLACEHOLDER, value: EDITOR_PLACEHOLDER_LABELS.title },
    { text: TABLE_HEADER_PLACEHOLDER, value: SLIDE_TABLE_HEADER_PLACEHOLDER_LABEL },
    { text: TABLE_CELL_PLACEHOLDER, value: SLIDE_TABLE_CELL_PLACEHOLDER_LABEL },
    { text: LIST_ITEM_PLACEHOLDER, value: EDITOR_PLACEHOLDER_LABELS.listItem },
    { text: EQUATION_PLACEHOLDER, value: SLIDE_EQUATION_PLACEHOLDER },
  ].sort((a, b) => b.text.length - a.text.length);

  for (const { text, value } of replacements) {
    if (text === TABLE_CELL_PLACEHOLDER) {
      result = replaceTableCellPlaceholders(result, value);
      continue;
    }
    result = result.replaceAll(text, value);
  }

  result = result.replace(
    new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(IMAGE_URL_PLACEHOLDER)}\\)`, "g"),
    `![${SLIDE_IMAGE_PLACEHOLDER_LABEL}]()`,
  );

  return result;
}

export function getEditorPlaceholderLabel(kind: EditorPlaceholderKind): string {
  switch (kind) {
    case "title":
      return EDITOR_PLACEHOLDER_LABELS.title;
    case "subtitle":
      return EDITOR_PLACEHOLDER_LABELS.subtitle;
    case "pageTitle":
      return EDITOR_PLACEHOLDER_LABELS.pageTitle;
    case "listItem":
      return EDITOR_PLACEHOLDER_LABELS.listItem;
    case "equation":
      return EDITOR_PLACEHOLDER_LABELS.equation;
    case "comment":
      return EDITOR_PLACEHOLDER_LABELS.comment;
    case "header":
      return EDITOR_PLACEHOLDER_LABELS.header;
    case "cell":
      return EDITOR_PLACEHOLDER_LABELS.cell;
    case "alt":
      return EDITOR_PLACEHOLDER_LABELS.alt;
    case "url":
      return EDITOR_PLACEHOLDER_LABELS.url;
  }
}
