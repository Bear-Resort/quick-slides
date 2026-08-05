/**
 * Explicit two-column layout for overflowing text-only slides.
 * Uses the same CSS grid pattern as image+text (`grid-cols-2`) — that path
 * already prints correctly in Browserless. Flex + absolute px widths got
 * clipped to the left half by overflow:hidden ancestors.
 */

import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";

export const SLIDE_TWO_COL_ATTR = "data-slide-two-col";
export const SLIDE_CONTENT_PAD_X = 48;

/** Match Tailwind `gap-10` used by image+text rows. */
export const TWO_COL_GAP_PX = 40;

export const TWO_COL_GRID_STYLE =
  "display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:2.5rem;row-gap:0;align-items:start;width:100%;max-width:100%;min-width:0;box-sizing:border-box;";

export const TWO_COL_PANE_STYLE =
  "min-width:0;width:auto;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word;";

type Piece = {
  html: string;
  height: number;
  listTag?: "OL" | "UL";
  listClass?: string;
  olItemIndex?: number;
};

function isList(el: Element): el is HTMLOListElement | HTMLUListElement {
  return el.tagName === "OL" || el.tagName === "UL";
}

function pieceHeight(el: HTMLElement): number {
  return Math.max(el.getBoundingClientRect().height, el.scrollHeight, 24);
}

function collectPiecesFrom(markdown: HTMLElement): Piece[] {
  const pieces: Piece[] = [];
  let olItemIndex = 0;

  for (const block of [...markdown.children] as HTMLElement[]) {
    if (isList(block) && block.children.length > 0) {
      const listTag = block.tagName as "OL" | "UL";
      const listClass = block.className;
      for (const li of [...block.children] as HTMLElement[]) {
        pieces.push({
          html: li.outerHTML,
          height: pieceHeight(li),
          listTag,
          listClass,
          olItemIndex: listTag === "OL" ? olItemIndex : undefined,
        });
        if (listTag === "OL") olItemIndex += 1;
      }
    } else if (
      block.classList.contains("slide-two-col-grid") ||
      block.classList.contains("slide-text-two-col")
    ) {
      return [];
    } else {
      pieces.push({
        html: block.outerHTML,
        height: pieceHeight(block),
      });
    }
  }

  return pieces;
}

function joinPiecesHtml(pieces: Piece[]): string {
  let html = "";
  let openTag: string | null = null;
  let openClass = "";

  const closeList = () => {
    if (openTag) {
      html += `</${openTag.toLowerCase()}>`;
      openTag = null;
      openClass = "";
    }
  };

  for (const piece of pieces) {
    if (piece.listTag) {
      if (openTag !== piece.listTag) {
        closeList();
        openTag = piece.listTag;
        openClass = piece.listClass ?? "";
        const startAttr =
          piece.listTag === "OL" &&
          piece.olItemIndex != null &&
          piece.olItemIndex > 0
            ? ` start="${piece.olItemIndex + 1}"`
            : "";
        const classAttr = openClass ? ` class="${openClass}"` : "";
        html += `<${openTag.toLowerCase()}${classAttr}${startAttr}>`;
      }
      html += piece.html;
    } else {
      closeList();
      html += piece.html;
    }
  }
  closeList();
  return html;
}

/** Contiguous split: fill left until ~half total height, rest on the right. */
function splitPiecesContiguous(pieces: Piece[]): {
  left: Piece[];
  right: Piece[];
} {
  if (pieces.length <= 1) {
    return { left: pieces, right: [] };
  }

  const total = pieces.reduce((sum, p) => sum + p.height, 0);
  const target = total / 2;
  let leftH = 0;
  let splitAt = Math.max(1, Math.floor(pieces.length / 2));

  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i]!;
    if (i > 0 && leftH >= target) {
      splitAt = i;
      break;
    }
    if (i > 0 && leftH + piece.height > target && leftH >= target * 0.4) {
      splitAt = i;
      break;
    }
    leftH += piece.height;
    splitAt = i + 1;
  }

  if (splitAt >= pieces.length) {
    splitAt = Math.max(1, pieces.length - 1);
  }

  return {
    left: pieces.slice(0, splitAt),
    right: pieces.slice(splitAt),
  };
}

export type TwoColumnHtml = {
  left: string;
  right: string;
  className: string;
};

/**
 * Non-mutating split of a rendered markdown root into left/right HTML.
 * Measures at the element's real width (full content area for text-only slides).
 */
export function splitMarkdownToTwoColumnHtml(
  markdown: HTMLElement,
): TwoColumnHtml | null {
  if (
    markdown.querySelector(".slide-two-col-grid, .slide-text-two-col")
  ) {
    return null;
  }

  const widthPx = Math.max(markdown.clientWidth, markdown.offsetWidth, 600);
  const probe = markdown.cloneNode(true) as HTMLElement;
  probe.style.cssText = [
    "position:absolute",
    "left:-10000px",
    "top:0",
    `width:${widthPx}px`,
    "max-width:none",
    "columns:auto",
    "column-count:auto",
    "visibility:hidden",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");

  document.body.appendChild(probe);

  try {
    void probe.offsetHeight;
    const pieces = collectPiecesFrom(probe);
    if (pieces.length < 2) return null;

    const { left, right } = splitPiecesContiguous(pieces);
    if (left.length === 0 || right.length === 0) return null;

    return {
      left: joinPiecesHtml(left),
      right: joinPiecesHtml(right),
      className: markdown.className,
    };
  } finally {
    probe.remove();
  }
}

/** Reinforce the image-style 1fr/1fr grid on text two-col rows. */
export function reinforceTwoColumnLayout(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>(".slide-two-col-grid, .slide-text-two-col")
    .forEach((grid) => {
      grid.style.cssText = TWO_COL_GRID_STYLE;
    });
  root.querySelectorAll<HTMLElement>(".slide-two-col-pane").forEach((pane) => {
    pane.style.cssText = TWO_COL_PANE_STYLE;
  });
  root
    .querySelectorAll<HTMLElement>(`[${SLIDE_TWO_COL_ATTR}="true"]`)
    .forEach((host) => {
      host.style.setProperty("columns", "auto", "important");
      host.style.setProperty("column-count", "auto", "important");
      host.style.setProperty("column-width", "auto", "important");
      host.style.width = "100%";
      host.style.maxWidth = "100%";
      host.style.minWidth = "0";
      host.style.boxSizing = "border-box";
    });
}

/**
 * Export fallback: if overflow markdown was never split by React, split it now.
 */
export function materializeTwoColumnsInRoot(root: ParentNode): void {
  const targets = root.querySelectorAll<HTMLElement>(
    ".slide-content-overflow .markdown-preview.slide-content, [data-slide-layout='content'] .markdown-preview.slide-content",
  );

  for (const el of targets) {
    if (
      el.getAttribute(SLIDE_TWO_COL_ATTR) === "true" ||
      el.querySelector(".slide-two-col-grid, .slide-text-two-col")
    ) {
      continue;
    }

    // Only auto-split text-only layouts (never inside image+text grids).
    if (el.closest("[data-slide-layout='content-image']")) continue;
    if (el.closest(".slide-sticker-shift-target.grid")) continue;

    const body = el.closest(".slide-fit-content-body");
    if (body && !body.classList.contains("slide-content-overflow")) {
      // Still allow split when content clearly overflows its container.
      const container = body.parentElement?.parentElement;
      if (
        !container ||
        el.scrollHeight <= container.clientHeight + 1
      ) {
        continue;
      }
    }

    const split = splitMarkdownToTwoColumnHtml(el);
    if (!split) continue;

    el.setAttribute(SLIDE_TWO_COL_ATTR, "true");
    el.style.setProperty("columns", "auto", "important");
    el.style.setProperty("column-count", "auto", "important");
    if (split.className) el.className = split.className;
    el.innerHTML = `<div class="slide-text-two-col slide-two-col-grid" style="${TWO_COL_GRID_STYLE}"><div class="slide-two-col-pane" style="${TWO_COL_PANE_STYLE}">${split.left}</div><div class="slide-two-col-pane" style="${TWO_COL_PANE_STYLE}">${split.right}</div></div>`;
  }

  reinforceTwoColumnLayout(root);
}

/**
 * Pin page geometry and bake image-row + text-two-col grids the same way.
 */
export function pinSlideContentGeometry(root: ParentNode): void {
  const pinSize = (el: HTMLElement, width: number, height?: number) => {
    el.style.setProperty("width", `${width}px`, "important");
    el.style.setProperty("max-width", `${width}px`, "important");
    el.style.setProperty("box-sizing", "border-box", "important");
    if (height != null) {
      el.style.setProperty("height", `${height}px`, "important");
    }
  };

  root.querySelectorAll<HTMLElement>(".export-pdf-page, .export-slide-page").forEach((page) => {
    pinSize(page, SLIDE_WIDTH, SLIDE_HEIGHT);
    page.style.setProperty("overflow", "hidden", "important");
  });

  root.querySelectorAll<HTMLElement>(".slide-frame, .slide-canvas, .slide-canvas > div").forEach((el) => {
    pinSize(el, SLIDE_WIDTH, SLIDE_HEIGHT);
  });

  root.querySelectorAll<HTMLElement>(".slide-content-layout").forEach((el) => {
    el.style.setProperty("display", "flex", "important");
    el.style.setProperty("flex-direction", "column", "important");
    el.style.setProperty("align-items", "stretch", "important");
    pinSize(el, SLIDE_WIDTH);
    el.style.setProperty("padding-left", `${SLIDE_CONTENT_PAD_X}px`, "important");
    el.style.setProperty("padding-right", `${SLIDE_CONTENT_PAD_X}px`, "important");
  });

  // Text-only: lock the body to the full content box (1184px), then let the
  // inner 1fr/1fr grid fill 100% of that — same usable width as image+text rows.
  const inner = SLIDE_WIDTH - SLIDE_CONTENT_PAD_X * 2;
  root
    .querySelectorAll<HTMLElement>("[data-slide-layout='content']")
    .forEach((layout) => {
      layout
        .querySelectorAll<HTMLElement>(
          ":scope > .slide-content-slide-body, :scope > .slide-content-slide-body .slide-fit-content-body, :scope > .slide-content-slide-body .slide-fit-content-body > div",
        )
        .forEach((el) => {
          pinSize(el, inner);
          el.style.setProperty("min-width", `${inner}px`, "important");
          el.style.setProperty("align-self", "stretch", "important");
          el.style.setProperty("overflow", "visible", "important");
        });
    });

  // Image+text and text two-col: same 2-column grid bake.
  root
    .querySelectorAll<HTMLElement>(
      ".slide-sticker-shift-target.grid, .slide-text-two-col, .slide-two-col-grid",
    )
    .forEach((grid) => {
      grid.style.setProperty("display", "grid", "important");
      grid.style.setProperty(
        "grid-template-columns",
        "minmax(0, 1fr) minmax(0, 1fr)",
        "important",
      );
      grid.style.setProperty("column-gap", "2.5rem", "important");
      grid.style.setProperty("align-items", "start", "important");
      grid.style.setProperty("width", "100%", "important");
      grid.style.setProperty("max-width", "100%", "important");
      grid.style.setProperty("min-width", "0", "important");
      grid.style.setProperty("box-sizing", "border-box", "important");
    });

  reinforceTwoColumnLayout(root);
}
