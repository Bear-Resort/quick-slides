/** Split markdown into slides separated by `---` or a `###` content heading. */

import { stripInlineHtmlComments } from "@/lib/markdown";

export type SlideChunk = {
  content: string;
  /** Editor line where slide content begins (for locate). */
  startLine: number;
  /** Editor line where the page label is shown. */
  markerLine: number;
};

function isFenceToggle(line: string): boolean {
  return line.trim().startsWith("```");
}

function isSeparatorLine(line: string): boolean {
  return /^---\s*$/.test(line);
}

function isContentHeadingLine(line: string): boolean {
  return /^###\s+/.test(line);
}

function effectiveLine(line: string, inFence: boolean): string {
  return inFence ? line : stripInlineHtmlComments(line);
}

function isCommentOnlyLine(line: string): boolean {
  return line.trim().length > 0 && stripInlineHtmlComments(line).trim().length === 0;
}

export function splitSlidesWithMeta(markdown: string): SlideChunk[] {
  const lines = markdown.split("\n");
  const slides: SlideChunk[] = [];
  let buffer = "";
  let inFence = false;
  let slideStartLine = isSeparatorLine(stripInlineHtmlComments(lines[0] ?? "")) ? 1 : 0;
  let slideMarkerLine = isSeparatorLine(stripInlineHtmlComments(lines[0] ?? "")) ? 0 : 0;
  let pendingFirstMarker = !isSeparatorLine(stripInlineHtmlComments(lines[0] ?? ""));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    if (isFenceToggle(line)) {
      inFence = !inFence;
      buffer += `${line}\n`;
      continue;
    }

    if (isCommentOnlyLine(line)) {
      continue;
    }

    const contentLine = effectiveLine(line, inFence);

    if (!inFence) {
      if (isSeparatorLine(contentLine)) {
        if (buffer.trim().length > 0 || slides.length === 0) {
          if (pendingFirstMarker) {
            slideMarkerLine = 0;
            pendingFirstMarker = false;
          }
          slides.push({
            content: buffer.trim(),
            startLine: slideStartLine,
            markerLine: slideMarkerLine,
          });
        }
        buffer = "";
        slideStartLine = i + 1;
        slideMarkerLine = i;
        pendingFirstMarker = false;
        continue;
      }

      if (isContentHeadingLine(contentLine) && buffer.trim().length > 0) {
        if (pendingFirstMarker) {
          slideMarkerLine = 0;
          pendingFirstMarker = false;
        }
        slides.push({
          content: buffer.trim(),
          startLine: slideStartLine,
          markerLine: slideMarkerLine,
        });
        buffer = `${contentLine}\n`;
        slideStartLine = i;
        slideMarkerLine = i;
        continue;
      }
    }

    buffer += `${contentLine}\n`;
  }

  const trimmed = buffer.trim();
  if (trimmed.length > 0 || slides.length === 0) {
    if (pendingFirstMarker) {
      slideMarkerLine = 0;
    }
    slides.push({
      content: trimmed,
      startLine: slideStartLine,
      markerLine: slideMarkerLine,
    });
  }

  const nonEmpty = slides.filter((slide) => slide.content.length > 0);
  return nonEmpty.length > 0 ? nonEmpty : [{ content: "", startLine: 0, markerLine: 0 }];
}

export function splitSlides(markdown: string): string[] {
  return splitSlidesWithMeta(markdown).map((slide) => slide.content);
}
