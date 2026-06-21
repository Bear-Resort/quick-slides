import type { CSSProperties } from "react";
import type { SlideLayoutType } from "@/lib/slideLayout";
import { getStickerThemeSetup } from "@/lib/themes/registry";
import type {
  ResolvedStickerPlacement,
  StickerContentMitigation,
  StickerCorner,
  StickerSidePlacement,
  StickerSlideThemeId,
  StickerThemeEntry,
} from "@/lib/themes/types";
import { cn } from "@/lib/utils";

const CORNER_CLASS: Record<StickerCorner, string> = {
  br: "slide-sticker-corner-br",
  bl: "slide-sticker-corner-bl",
};

const SIDE_CLASS: Record<StickerSidePlacement, string> = {
  bottom: "slide-sticker-side-rb",
  center: "slide-sticker-side-r",
};

const LEFT_SIDE_CLASS: Record<StickerSidePlacement, string> = {
  bottom: "slide-sticker-side-lb",
  center: "slide-sticker-side-l",
};

const IMAGE_OVERLAP_SELECTORS =
  ".slide-image-panel, .slide-image-panel img:not(.sr-only)";

const TEXT_OVERLAP_SELECTORS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "blockquote",
  "table",
  "pre",
  ".slide-content-heading",
  ".slide-primary-heading",
  ".katex-display",
  "img:not(.sr-only):not(.slide-sticker-decoration)",
].join(",");

const OVERLAP_SELECTORS = `${TEXT_OVERLAP_SELECTORS}, ${IMAGE_OVERLAP_SELECTORS}`;

/** Headings/titles fixed above a shift target — shifted content must not overlap these. */
const SHIFT_PROTECTED_SELECTORS =
  ".slide-content-heading, .slide-primary-heading, h1, h2";

const OVERLAP_INSET_PX = 12;
const MIN_STICKER_HEIGHT_PX = 100;
const SHIFT_UP_STEPS_PX = [16, 32, 48, 64, 96, 128];
const SHRINK_STEP_PX = 12;
const RIGHT_RESERVE_GAP_PX = 20;
const LEFT_RESERVE_GAP_PX = 20;

const EMPTY_MITIGATION: StickerContentMitigation = {
  shiftUpPx: 0,
  contentColumns: 1,
  reserveRightPx: 0,
  reserveLeftPx: 0,
};

function rectsOverlap(a: DOMRect, b: DOMRect, inset = OVERLAP_INSET_PX): boolean {
  return !(
    a.right - inset <= b.left ||
    a.left + inset >= b.right ||
    a.bottom - inset <= b.top ||
    a.top + inset >= b.bottom
  );
}

function decorationOverlapsSelectors(
  decorationRect: DOMRect,
  contentEl: HTMLElement,
  selectors: string,
): boolean {
  for (const el of contentEl.querySelectorAll(selectors)) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    if (rectsOverlap(decorationRect, rect)) return true;
  }
  return false;
}

function decorationOverlapsContent(
  decorationRect: DOMRect,
  contentEl: HTMLElement,
): boolean {
  return decorationOverlapsSelectors(
    decorationRect,
    contentEl,
    OVERLAP_SELECTORS,
  );
}

function hasSlideImagePanel(contentEl: HTMLElement): boolean {
  return contentEl.querySelector(".slide-image-panel") !== null;
}

function stickerOverlaps(
  element: HTMLImageElement,
  contentEl: HTMLElement,
): boolean {
  return decorationOverlapsContent(element.getBoundingClientRect(), contentEl);
}

function queryShiftTargets(contentEl: HTMLElement): HTMLElement[] {
  return [...contentEl.querySelectorAll(".slide-sticker-shift-target")].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

function queryProtectedFromShiftElements(contentEl: HTMLElement): HTMLElement[] {
  const seen = new Set<HTMLElement>();

  const add = (el: Element | null) => {
    if (!(el instanceof HTMLElement) || seen.has(el)) return;
    if (el.closest(".slide-sticker-shift-target")) return;
    seen.add(el);
  };

  for (const el of contentEl.querySelectorAll(SHIFT_PROTECTED_SELECTORS)) {
    add(el);
  }

  return [...seen];
}

/** Max upward shift before `.slide-sticker-shift-target` content overlaps fixed headings. */
function measureMaxSafeShiftUp(contentEl: HTMLElement): number {
  const targets = queryShiftTargets(contentEl);
  const protectedEls = queryProtectedFromShiftElements(contentEl);
  if (targets.length === 0 || protectedEls.length === 0) {
    return SHIFT_UP_STEPS_PX.at(-1) ?? 128;
  }

  let maxShift = Infinity;
  for (const target of targets) {
    const targetRect = target.getBoundingClientRect();
    for (const protectedEl of protectedEls) {
      const protectedRect = protectedEl.getBoundingClientRect();
      const allowed = targetRect.top - protectedRect.bottom - OVERLAP_INSET_PX;
      maxShift = Math.min(maxShift, allowed);
    }
  }

  return Math.max(0, Math.floor(maxShift));
}

function clampMitigationShift(
  contentEl: HTMLElement,
  mitigation: StickerContentMitigation,
): StickerContentMitigation {
  if (mitigation.shiftUpPx <= 0) return mitigation;
  const maxSafe = measureMaxSafeShiftUp(contentEl);
  return {
    ...mitigation,
    shiftUpPx: Math.min(mitigation.shiftUpPx, maxSafe),
  };
}

function getAllowedShiftSteps(contentEl: HTMLElement): number[] {
  const maxSafe = measureMaxSafeShiftUp(contentEl);
  return SHIFT_UP_STEPS_PX.filter((step) => step <= maxSafe);
}

function shiftWouldOverlapProtected(
  contentEl: HTMLElement,
  shiftUpPx: number,
): boolean {
  if (shiftUpPx <= 0) return false;

  const targets = queryShiftTargets(contentEl);
  const protectedEls = queryProtectedFromShiftElements(contentEl);

  for (const target of targets) {
    const targetRect = target.getBoundingClientRect();
    const shiftedRect = new DOMRect(
      targetRect.x,
      targetRect.top - shiftUpPx,
      targetRect.width,
      targetRect.height,
    );
    for (const protectedEl of protectedEls) {
      const protectedRect = protectedEl.getBoundingClientRect();
      if (rectsOverlap(shiftedRect, protectedRect)) return true;
    }
  }

  return false;
}

function applyMitigationIfSafe(
  contentEl: HTMLElement,
  mitigation: StickerContentMitigation,
): StickerContentMitigation {
  const clamped = clampMitigationShift(contentEl, mitigation);
  applyContentMitigation(contentEl, clamped);
  return clamped;
}

export function pickStickerForSlide(
  themeId: StickerSlideThemeId,
  slideIndex: number,
  layout: SlideLayoutType,
): StickerThemeEntry | null {
  const setup = getStickerThemeSetup(themeId);
  const candidates = setup.stickers.filter((entry) => entry.layouts.includes(layout));
  if (candidates.length === 0) return null;
  return candidates[slideIndex % candidates.length] ?? null;
}

export function clearContentMitigation(contentEl: HTMLElement): void {
  contentEl.classList.remove(
    "slide-sticker-mitigation-shift",
    "slide-sticker-mitigation-columns",
    "slide-sticker-mitigation-right",
    "slide-sticker-mitigation-left",
  );
  contentEl.style.removeProperty("--slide-sticker-shift-up");
  contentEl.style.removeProperty("--slide-content-columns");
  contentEl.style.removeProperty("--slide-sticker-reserve-right");
  contentEl.style.removeProperty("--slide-sticker-reserve-left");
}

export function applyContentMitigation(
  contentEl: HTMLElement,
  mitigation: StickerContentMitigation,
): void {
  contentEl.classList.toggle(
    "slide-sticker-mitigation-shift",
    mitigation.shiftUpPx > 0,
  );
  contentEl.classList.toggle(
    "slide-sticker-mitigation-columns",
    mitigation.contentColumns >= 2,
  );
  contentEl.classList.toggle(
    "slide-sticker-mitigation-right",
    mitigation.reserveRightPx > 0,
  );
  contentEl.classList.toggle(
    "slide-sticker-mitigation-left",
    mitigation.reserveLeftPx > 0,
  );

  if (mitigation.shiftUpPx > 0) {
    contentEl.style.setProperty(
      "--slide-sticker-shift-up",
      `${mitigation.shiftUpPx}px`,
    );
  } else {
    contentEl.style.removeProperty("--slide-sticker-shift-up");
  }

  if (mitigation.contentColumns >= 2) {
    contentEl.style.setProperty(
      "--slide-content-columns",
      `${mitigation.contentColumns}`,
    );
  } else {
    contentEl.style.removeProperty("--slide-content-columns");
  }

  if (mitigation.reserveRightPx > 0) {
    contentEl.style.setProperty(
      "--slide-sticker-reserve-right",
      `${mitigation.reserveRightPx}px`,
    );
  } else {
    contentEl.style.removeProperty("--slide-sticker-reserve-right");
  }

  if (mitigation.reserveLeftPx > 0) {
    contentEl.style.setProperty(
      "--slide-sticker-reserve-left",
      `${mitigation.reserveLeftPx}px`,
    );
  } else {
    contentEl.style.removeProperty("--slide-sticker-reserve-left");
  }
}

function getPreferredBottomCorner(
  slideIndex: number,
  layout: SlideLayoutType,
  contentEl?: HTMLElement,
): StickerCorner {
  if (layout === "content") {
    if (contentEl && hasSlideImagePanel(contentEl)) return "bl";
    return "br";
  }
  return slideIndex % 2 === 0 ? "br" : "bl";
}

function getBottomCornerCandidates(
  slideIndex: number,
  layout: SlideLayoutType,
  contentEl: HTMLElement,
): StickerCorner[] {
  if (layout === "content") {
    if (hasSlideImagePanel(contentEl)) {
      return ["bl", "br"];
    }
    return ["br"];
  }
  const preferred = getPreferredBottomCorner(slideIndex, layout, contentEl);
  const other: StickerCorner = preferred === "br" ? "bl" : "br";
  return [preferred, other];
}

function stickerSizeStyle(maxHeight: number): CSSProperties {
  return {
    maxHeight: `${maxHeight}px`,
    height: "auto",
    width: "auto",
    maxWidth: "280px",
    display: "block",
  };
}

function resetPositionStyles(element: HTMLImageElement): void {
  element.style.top = "";
  element.style.right = "";
  element.style.bottom = "";
  element.style.left = "";
  element.style.transform = "";
}

function applyBottomCornerStyle(
  element: HTMLImageElement,
  corner: StickerCorner,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
): void {
  element.className = cn("slide-sticker-decoration", CORNER_CLASS[corner]);
  element.src = entry.src;
  resetPositionStyles(element);
  Object.assign(element.style, stickerSizeStyle(renderedMaxHeight));
}

function applyRightSideStyle(
  element: HTMLImageElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  side: StickerSidePlacement,
): void {
  element.className = cn("slide-sticker-decoration", SIDE_CLASS[side]);
  element.src = entry.src;
  resetPositionStyles(element);
  Object.assign(element.style, stickerSizeStyle(renderedMaxHeight));
  if (side === "center") {
    element.style.transform = "translateY(-50%)";
  }
}

function applyLeftSideStyle(
  element: HTMLImageElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  side: StickerSidePlacement,
): void {
  element.className = cn("slide-sticker-decoration", LEFT_SIDE_CLASS[side]);
  element.src = entry.src;
  resetPositionStyles(element);
  Object.assign(element.style, stickerSizeStyle(renderedMaxHeight));
  if (side === "center") {
    element.style.transform = "translateY(-50%)";
  }
}

function measureReserveRight(element: HTMLImageElement): number {
  const width = element.getBoundingClientRect().width;
  if (width <= 0) return 160;
  return Math.ceil(width + RIGHT_RESERVE_GAP_PX);
}

function measureReserveLeft(element: HTMLImageElement): number {
  const width = element.getBoundingClientRect().width;
  if (width <= 0) return 160;
  return Math.ceil(width + LEFT_RESERVE_GAP_PX);
}

function pickCornerWithoutOverlap(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  slideIndex: number,
  renderedMaxHeight: number,
  layout: SlideLayoutType,
): StickerCorner {
  const preferred = getPreferredBottomCorner(slideIndex, layout, contentEl);
  for (const corner of getBottomCornerCandidates(slideIndex, layout, contentEl)) {
    applyBottomCornerStyle(element, corner, entry, renderedMaxHeight);
    if (!stickerOverlaps(element, contentEl)) {
      return corner;
    }
  }
  applyBottomCornerStyle(element, preferred, entry, renderedMaxHeight);
  return preferred;
}

function buildPlacement(
  entry: StickerThemeEntry,
  className: string,
  renderedMaxHeight: number,
  contentMitigation: StickerContentMitigation,
  style: CSSProperties = stickerSizeStyle(renderedMaxHeight),
): ResolvedStickerPlacement {
  return {
    imageUrl: entry.src,
    maxHeight: entry.maxHeight,
    renderedMaxHeight,
    className,
    style,
    contentMitigation,
  };
}

function tryCornerPlacement(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  slideIndex: number,
  renderedMaxHeight: number,
  layout: SlideLayoutType,
  mitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  const safeMitigation = applyMitigationIfSafe(contentEl, mitigation);
  if (shiftWouldOverlapProtected(contentEl, safeMitigation.shiftUpPx)) {
    applyContentMitigation(contentEl, { ...safeMitigation, shiftUpPx: 0 });
    return null;
  }

  const corner = pickCornerWithoutOverlap(
    element,
    contentEl,
    entry,
    slideIndex,
    renderedMaxHeight,
    layout,
  );
  if (!stickerOverlaps(element, contentEl)) {
    return buildPlacement(
      entry,
      cn("slide-sticker-decoration", CORNER_CLASS[corner]),
      renderedMaxHeight,
      safeMitigation,
    );
  }
  return null;
}

function tryRightSidePlacement(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  side: StickerSidePlacement,
  baseMitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  applyRightSideStyle(element, entry, renderedMaxHeight, side);
  const reserveRightPx = measureReserveRight(element);
  const mitigation: StickerContentMitigation = {
    ...baseMitigation,
    reserveLeftPx: 0,
    reserveRightPx,
  };
  const safeMitigation = applyMitigationIfSafe(contentEl, mitigation);
  if (shiftWouldOverlapProtected(contentEl, safeMitigation.shiftUpPx)) {
    applyContentMitigation(contentEl, { ...baseMitigation, shiftUpPx: 0 });
    return null;
  }

  if (!stickerOverlaps(element, contentEl)) {
    const style: CSSProperties = {
      ...stickerSizeStyle(renderedMaxHeight),
      ...(side === "center" ? { transform: "translateY(-50%)" } : {}),
    };
    return buildPlacement(
      entry,
      cn("slide-sticker-decoration", SIDE_CLASS[side]),
      renderedMaxHeight,
      safeMitigation,
      style,
    );
  }
  return null;
}

function tryRightSideFallbacks(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  baseMitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  for (const side of ["bottom", "center"] as const) {
    const placement = tryRightSidePlacement(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      side,
      baseMitigation,
    );
    if (placement) return placement;
  }
  return null;
}

function tryLeftSidePlacement(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  side: StickerSidePlacement,
  baseMitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  applyLeftSideStyle(element, entry, renderedMaxHeight, side);
  const reserveLeftPx = measureReserveLeft(element);
  const mitigation: StickerContentMitigation = {
    ...baseMitigation,
    reserveRightPx: 0,
    reserveLeftPx,
  };
  const safeMitigation = applyMitigationIfSafe(contentEl, mitigation);
  if (shiftWouldOverlapProtected(contentEl, safeMitigation.shiftUpPx)) {
    applyContentMitigation(contentEl, { ...baseMitigation, shiftUpPx: 0 });
    return null;
  }

  if (!stickerOverlaps(element, contentEl)) {
    const style: CSSProperties = {
      ...stickerSizeStyle(renderedMaxHeight),
      ...(side === "center" ? { transform: "translateY(-50%)" } : {}),
    };
    return buildPlacement(
      entry,
      cn("slide-sticker-decoration", LEFT_SIDE_CLASS[side]),
      renderedMaxHeight,
      safeMitigation,
      style,
    );
  }
  return null;
}

function tryLeftSideFallbacks(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  renderedMaxHeight: number,
  baseMitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  const safeBase = applyMitigationIfSafe(contentEl, {
    ...baseMitigation,
    reserveRightPx: 0,
    reserveLeftPx: 0,
  });
  if (shiftWouldOverlapProtected(contentEl, safeBase.shiftUpPx)) {
    applyContentMitigation(contentEl, { ...baseMitigation, shiftUpPx: 0 });
  }

  applyBottomCornerStyle(element, "bl", entry, renderedMaxHeight);
  if (!stickerOverlaps(element, contentEl)) {
    const mitigation = shiftWouldOverlapProtected(contentEl, safeBase.shiftUpPx)
      ? { ...baseMitigation, reserveRightPx: 0, reserveLeftPx: 0, shiftUpPx: 0 }
      : safeBase;
    applyContentMitigation(contentEl, mitigation);
    return buildPlacement(
      entry,
      cn("slide-sticker-decoration", CORNER_CLASS.bl),
      renderedMaxHeight,
      mitigation,
    );
  }

  for (const side of ["bottom", "center"] as const) {
    const placement = tryLeftSidePlacement(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      side,
      baseMitigation,
    );
    if (placement) return placement;
  }
  return null;
}

function buildStickerHeights(maxHeight: number): number[] {
  const heights: number[] = [];
  for (
    let height = maxHeight;
    height >= MIN_STICKER_HEIGHT_PX;
    height -= SHRINK_STEP_PX
  ) {
    heights.push(height);
  }
  if (heights.at(-1) !== MIN_STICKER_HEIGHT_PX) {
    heights.push(MIN_STICKER_HEIGHT_PX);
  }
  return heights;
}

function tryMitigatedPlacements(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  slideIndex: number,
  renderedMaxHeight: number,
  layout: SlideLayoutType,
  mitigation: StickerContentMitigation,
): ResolvedStickerPlacement | null {
  const hasImage = hasSlideImagePanel(contentEl);

  const corner = tryCornerPlacement(
    element,
    contentEl,
    entry,
    slideIndex,
    renderedMaxHeight,
    layout,
    mitigation,
  );
  if (corner) return corner;

  if (hasImage) {
    const left = tryLeftSideFallbacks(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      mitigation,
    );
    if (left) return left;

    const right = tryRightSideFallbacks(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      mitigation,
    );
    if (right) return right;
  } else {
    const right = tryRightSideFallbacks(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      mitigation,
    );
    if (right) return right;

    const left = tryLeftSideFallbacks(
      element,
      contentEl,
      entry,
      renderedMaxHeight,
      mitigation,
    );
    if (left) return left;
  }

  return null;
}

function resolveContentSlidePlacement(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  slideIndex: number,
): ResolvedStickerPlacement {
  clearContentMitigation(contentEl);
  const layout: SlideLayoutType = "content";
  const heights = buildStickerHeights(entry.maxHeight);
  const shiftSteps = getAllowedShiftSteps(contentEl);

  for (const renderedMaxHeight of heights) {
    clearContentMitigation(contentEl);
    const atMinHeight = renderedMaxHeight <= MIN_STICKER_HEIGHT_PX;

    const centered = tryMitigatedPlacements(
      element,
      contentEl,
      entry,
      slideIndex,
      renderedMaxHeight,
      layout,
      EMPTY_MITIGATION,
    );
    if (centered) return centered;

    for (const shiftUpPx of shiftSteps) {
      const shifted = tryMitigatedPlacements(
        element,
        contentEl,
        entry,
        slideIndex,
        renderedMaxHeight,
        layout,
        { ...EMPTY_MITIGATION, shiftUpPx },
      );
      if (shifted) return shifted;
    }

    if (atMinHeight) {
      for (const shiftUpPx of [0, ...shiftSteps]) {
        for (const contentColumns of [2, 3] as const) {
          const mitigation = {
            shiftUpPx,
            contentColumns,
            reserveRightPx: 0,
            reserveLeftPx: 0,
          };

          const columns = tryMitigatedPlacements(
            element,
            contentEl,
            entry,
            slideIndex,
            MIN_STICKER_HEIGHT_PX,
            layout,
            mitigation,
          );
          if (columns) return columns;
        }
      }
    }
  }

  const allowOverlap = tryMitigatedPlacements(
    element,
    contentEl,
    entry,
    slideIndex,
    MIN_STICKER_HEIGHT_PX,
    layout,
    EMPTY_MITIGATION,
  );
  if (allowOverlap) return allowOverlap;

  const corner = pickCornerWithoutOverlap(
    element,
    contentEl,
    entry,
    slideIndex,
    MIN_STICKER_HEIGHT_PX,
    layout,
  );
  applyContentMitigation(contentEl, EMPTY_MITIGATION);
  return buildPlacement(
    entry,
    cn("slide-sticker-decoration", CORNER_CLASS[corner]),
    MIN_STICKER_HEIGHT_PX,
    EMPTY_MITIGATION,
  );
}

export function resolveStickerPlacement(
  element: HTMLImageElement,
  contentEl: HTMLElement,
  entry: StickerThemeEntry,
  slideIndex: number,
  layout: SlideLayoutType,
): ResolvedStickerPlacement {
  if (layout === "content") {
    return resolveContentSlidePlacement(element, contentEl, entry, slideIndex);
  }

  clearContentMitigation(contentEl);
  const layoutCorner = pickCornerWithoutOverlap(
    element,
    contentEl,
    entry,
    slideIndex,
    entry.maxHeight,
    layout,
  );
  if (!stickerOverlaps(element, contentEl)) {
    return buildPlacement(
      entry,
      cn("slide-sticker-decoration", CORNER_CLASS[layoutCorner]),
      entry.maxHeight,
      EMPTY_MITIGATION,
    );
  }

  for (const side of ["left", "right"] as const) {
    const placement =
      side === "left"
        ? tryLeftSideFallbacks(
            element,
            contentEl,
            entry,
            entry.maxHeight,
            EMPTY_MITIGATION,
          )
        : tryRightSideFallbacks(
            element,
            contentEl,
            entry,
            entry.maxHeight,
            EMPTY_MITIGATION,
          );
    if (placement) return placement;
  }

  for (const shiftUpPx of getAllowedShiftSteps(contentEl)) {
    const mitigation = { ...EMPTY_MITIGATION, shiftUpPx };
    for (const side of ["left", "right"] as const) {
      const placement =
        side === "left"
          ? tryLeftSideFallbacks(
              element,
              contentEl,
              entry,
              entry.maxHeight,
              mitigation,
            )
          : tryRightSideFallbacks(
              element,
              contentEl,
              entry,
              entry.maxHeight,
              mitigation,
            );
      if (placement) return placement;
    }
  }

  return buildPlacement(
    entry,
    cn("slide-sticker-decoration", CORNER_CLASS[layoutCorner]),
    entry.maxHeight,
    EMPTY_MITIGATION,
  );
}

export function getInitialStickerPlacement(
  entry: StickerThemeEntry,
  slideIndex: number,
  layout: SlideLayoutType = "content",
  contentEl?: HTMLElement | null,
): ResolvedStickerPlacement {
  const corner =
    layout === "content" && contentEl && hasSlideImagePanel(contentEl)
      ? "bl"
      : layout === "content"
        ? "br"
        : slideIndex % 2 === 0
          ? "br"
          : "bl";
  return buildPlacement(
    entry,
    cn("slide-sticker-decoration", CORNER_CLASS[corner]),
    entry.maxHeight,
    EMPTY_MITIGATION,
  );
}
