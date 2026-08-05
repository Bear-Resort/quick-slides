import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";
import {
  SLIDE_FIT_READY_ATTR,
  SLIDE_FIT_REMEASURE_EVENT,
} from "@/lib/slideFitContent";
import {
  materializeTwoColumnsInRoot,
  pinSlideContentGeometry,
} from "@/lib/slideTwoColumn";

const KATEX_FONT_FAMILIES = [
  "KaTeX_AMS",
  "KaTeX_Caligraphic",
  "KaTeX_Fraktur",
  "KaTeX_Main",
  "KaTeX_Math",
  "KaTeX_SansSerif",
  "KaTeX_Script",
  "KaTeX_Size1",
  "KaTeX_Size2",
  "KaTeX_Size3",
  "KaTeX_Size4",
  "KaTeX_Typewriter",
] as const;

const TEXTUAL_TAGS = new Set([
  "H1",
  "H2",
  "H3",
  "H4",
  "P",
  "LI",
  "A",
  "SPAN",
  "STRONG",
  "EM",
  "BLOCKQUOTE",
  "TH",
  "TD",
  "CODE",
  "PRE",
  "LABEL",
]);

function shouldInlineVisualStyles(element: HTMLElement): boolean {
  const tag = element.tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "SVG") return false;
  if (element.closest(".katex-mathml")) return false;
  if (element.dataset.katexRaster === "true") return false;
  if (element.closest("[data-katex-raster='true']")) return false;
  // Never touch KaTeX internals — em-based sizing / 1px vlist-s break if inlined.
  if (element.closest(".katex") && !element.classList.contains("katex")) {
    return false;
  }
  return true;
}

/** Inline resolved paint + typography so html2canvas matches the live preview. */
function inlineVisualStyles(element: HTMLElement): void {
  if (!shouldInlineVisualStyles(element)) return;

  const computed = getComputedStyle(element);
  const isKatexRoot = element.classList.contains("katex");

  element.style.color = computed.color;

  const backgroundColor = computed.backgroundColor;
  if (backgroundColor && backgroundColor !== "rgba(0, 0, 0, 0)" && backgroundColor !== "transparent") {
    element.style.backgroundColor = backgroundColor;
  }

  if (computed.backgroundImage !== "none") {
    element.style.backgroundImage = computed.backgroundImage;
    element.style.backgroundSize = computed.backgroundSize;
    element.style.backgroundPosition = computed.backgroundPosition;
    element.style.backgroundRepeat = computed.backgroundRepeat;
  }

  if (computed.borderWidth !== "0px") {
    element.style.borderColor = computed.borderColor;
    element.style.borderWidth = computed.borderWidth;
    element.style.borderStyle = computed.borderStyle;
  }

  if (computed.boxShadow !== "none") {
    element.style.boxShadow = computed.boxShadow;
  }

  // Root .katex only — never descendants.
  if (isKatexRoot) {
    element.style.fontSize = computed.fontSize;
    element.style.color = computed.color;
    element.style.lineHeight = "1.2";
    return;
  }

  if (TEXTUAL_TAGS.has(element.tagName)) {
    element.style.fontSize = computed.fontSize;
    element.style.fontWeight = computed.fontWeight;
    element.style.fontStyle = computed.fontStyle;
    element.style.fontFamily = computed.fontFamily;
    element.style.textAlign = computed.textAlign;
    element.style.lineHeight = computed.lineHeight;
    element.style.letterSpacing = computed.letterSpacing;
  }
}

function inlineVisualStylesTree(root: HTMLElement): void {
  inlineVisualStyles(root);
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    inlineVisualStyles(element);
  });
}

const KATEX_LINE_HEIGHT = "1.2";

export function isKatexDisplay(mathEl: HTMLElement): boolean {
  return (
    mathEl.classList.contains("katex-display") ||
    Boolean(mathEl.closest(".katex-display"))
  );
}

export function getKatexSource(
  mathEl: HTMLElement,
): { tex: string; displayMode: boolean } | null {
  const dataTex =
    mathEl.getAttribute("data-tex")?.trim() ||
    mathEl.dataset.tex?.trim() ||
    null;
  if (dataTex) {
    return {
      tex: dataTex,
      displayMode: isKatexDisplay(mathEl),
    };
  }

  const mathml = mathEl.querySelector(".katex-mathml");
  if (!mathml) return null;

  const annotations = mathml.getElementsByTagName("annotation");
  for (const annotation of annotations) {
    if (annotation.getAttribute("encoding") !== "application/x-tex") continue;
    const tex = annotation.textContent?.trim();
    if (tex) {
      return {
        tex,
        displayMode: isKatexDisplay(mathEl),
      };
    }
  }

  return null;
}

/** Reset inherited slide typography so export layout matches KaTeX expectations. */
export function prepareKatexForCapture(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".katex").forEach((katexEl) => {
    const isDisplay =
      katexEl.classList.contains("katex-display") ||
      Boolean(katexEl.closest(".katex-display"));
    // Content-sized box — never stretch to the full slide width (Safari especially).
    katexEl.style.lineHeight = KATEX_LINE_HEIGHT;
    katexEl.style.display = "inline-block";
    katexEl.style.width = "auto";
    katexEl.style.maxWidth = "none";
    katexEl.style.whiteSpace = "nowrap";
    katexEl.style.wordBreak = "normal";
    katexEl.style.overflowWrap = "normal";
    katexEl.style.verticalAlign = isDisplay ? "middle" : "baseline";
    katexEl.style.textIndent = "0";
    katexEl.style.position = "relative";

    const computed = getComputedStyle(katexEl);
    const parent = katexEl.parentElement;
    const parentFont =
      parent instanceof HTMLElement
        ? Number.parseFloat(getComputedStyle(parent).fontSize)
        : Number.NaN;
    const selfFont = Number.parseFloat(computed.fontSize);
    if (!Number.isFinite(selfFont) || selfFont < 10) {
      const fallback =
        Number.isFinite(parentFont) && parentFont > 0
          ? parentFont * 1.12
          : 27;
      katexEl.style.fontSize = `${fallback}px`;
    } else {
      katexEl.style.fontSize = computed.fontSize;
    }
    katexEl.style.color = computed.color;

    // Never set font-size on descendants — KaTeX relies on em nesting / 1px vlist-s.
    katexEl.querySelectorAll<HTMLElement>(".katex-mathml").forEach((mathml) => {
      mathml.style.display = "none";
    });
  });
}

function getExportPageRoot(root: HTMLElement): HTMLElement {
  if (root.classList.contains("export-slide-page")) {
    return root;
  }
  return root.querySelector<HTMLElement>(".export-slide-page") ?? root;
}

export function extractBackgroundImageUrl(backgroundImage: string): string | null {
  const match = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
  return match?.[1] ?? null;
}

function preloadImage(src: string): Promise<void> {
  if (!src || src.startsWith("data:")) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/** Wait for SlideFitContent overflow-column measurement before export capture. */
export async function waitForSlideFitContent(root: ParentNode): Promise<void> {
  const bodies = root.querySelectorAll<HTMLElement>(".slide-fit-content-body");
  if (bodies.length === 0) return;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const allReady = [...bodies].every(
      (body) => body.getAttribute(SLIDE_FIT_READY_ATTR) === "true",
    );
    if (allReady) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/** Remeasure after fonts/images settle so column count matches the live preview. */
export async function remeasureSlideFitContent(root: ParentNode): Promise<void> {
  const bodies = root.querySelectorAll<HTMLElement>(".slide-fit-content-body");
  if (bodies.length === 0) return;

  for (const body of bodies) {
    body.removeAttribute(SLIDE_FIT_READY_ATTR);
    const container = body.parentElement?.parentElement;
    container?.dispatchEvent(
      new Event(SLIDE_FIT_REMEASURE_EVENT, { bubbles: true }),
    );
  }

  await waitForSlideFitContent(root);
}

/**
 * Finalize layout for print/PDF: explicit 2-pane row with locked pixel widths.
 */
export function inlineColumnStylesForCapture(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".slide-fit-content-body").forEach((body) => {
    body.style.alignSelf = "stretch";
    if (body.classList.contains("slide-content-overflow")) {
      body.style.maxHeight = "none";
      body.style.overflow = "visible";
    }
  });

  // Split any overflow markdown that React did not already turn into two panes.
  materializeTwoColumnsInRoot(root);

  // Bake page + shared 2-col grids (image+text and text overflow use the same grid).
  pinSlideContentGeometry(root);
}

/** Wait for slide images and CSS background images before html2canvas capture. */
export async function waitForCaptureImages(root: ParentNode): Promise<void> {
  const tasks: Promise<void>[] = [];
  const backgroundUrls = new Set<string>();

  for (const img of root.querySelectorAll("img")) {
    if (img.complete && img.naturalWidth > 0) continue;
    tasks.push(
      new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        // Already-broken or cached-empty images shouldn't block forever.
        window.setTimeout(done, 4_000);
      }),
    );
  }

  // Only check nodes that commonly carry theme/sticker backgrounds — not every span.
  const bgCandidates = root.querySelectorAll<HTMLElement>(
    ".slide-canvas, .slide-sticker, [class*='slide-theme'], [style*='background']",
  );
  for (const element of bgCandidates) {
    const url = extractBackgroundImageUrl(getComputedStyle(element).backgroundImage);
    if (url) backgroundUrls.add(url);
  }

  for (const url of backgroundUrls) {
    tasks.push(preloadImage(url));
  }

  if (tasks.length === 0) return;
  await Promise.race([
    Promise.all(tasks),
    new Promise<void>((resolve) => window.setTimeout(resolve, 6_000)),
  ]);
}

/** Wait for fonts and KaTeX layout before export. */
export async function waitForExportReady(
  root?: ParentNode,
  options?: { quick?: boolean },
): Promise<void> {
  const quick = options?.quick ?? false;

  await Promise.race([
    document.fonts.ready,
    new Promise<void>((resolve) => window.setTimeout(resolve, quick ? 1_500 : 4_000)),
  ]);

  if (!quick) {
    await Promise.all(
      KATEX_FONT_FAMILIES.flatMap((family) => [
        document.fonts.load(`400 16px "${family}"`).catch(() => undefined),
        document.fonts.load(`700 16px "${family}"`).catch(() => undefined),
      ]),
    );
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) =>
    setTimeout(resolve, quick ? 50 : 120),
  );

  if (!quick && root?.querySelector(".katex, [data-katex-raster='true']")) {
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
  }
}

/** Inline computed styles so html2canvas matches the live HTML preview. */
export function prepareSlideForCapture(root: HTMLElement): HTMLElement {
  const pageRoot = getExportPageRoot(root);

  pageRoot.style.width = `${SLIDE_WIDTH}px`;
  pageRoot.style.height = `${SLIDE_HEIGHT}px`;
  pageRoot.style.overflow = "hidden";
  pageRoot.style.position = "relative";

  const frame = pageRoot.querySelector<HTMLElement>(".slide-frame");
  const canvas = pageRoot.querySelector<HTMLElement>(".slide-canvas");
  for (const element of [frame, canvas]) {
    if (!element) continue;
    element.style.width = `${SLIDE_WIDTH}px`;
    element.style.height = `${SLIDE_HEIGHT}px`;
    element.style.overflow = "hidden";
  }

  inlineVisualStylesTree(pageRoot);

  pageRoot.querySelectorAll<HTMLElement>(".katex-display").forEach((element) => {
    element.style.display = "block";
    element.style.textAlign = "center";
    element.style.width = "100%";
  });

  return pageRoot;
}

export function getCaptureBackgroundColor(target: HTMLElement): string {
  const bg = getComputedStyle(target).backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
    return "#ffffff";
  }
  return bg;
}

export { SLIDE_HEIGHT, SLIDE_WIDTH };
