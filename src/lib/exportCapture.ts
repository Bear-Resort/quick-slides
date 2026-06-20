import { SLIDE_HEIGHT, SLIDE_WIDTH } from "@/lib/slideCanvas";

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
  return true;
}

/** Inline resolved paint + typography so html2canvas matches the live preview. */
function inlineVisualStyles(element: HTMLElement): void {
  if (!shouldInlineVisualStyles(element)) return;

  const computed = getComputedStyle(element);
  const isKatexNode = element.classList.contains("katex") || Boolean(element.closest(".katex"));

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

  if (isKatexNode || TEXTUAL_TAGS.has(element.tagName)) {
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
    const isDisplay = katexEl.classList.contains("katex-display");
    katexEl.style.lineHeight = KATEX_LINE_HEIGHT;
    katexEl.style.display = isDisplay ? "block" : "inline-block";

    const computed = getComputedStyle(katexEl);
    katexEl.style.color = computed.color;
    katexEl.style.fontSize = computed.fontSize;

    katexEl.querySelectorAll<HTMLElement>("*").forEach((node) => {
      node.style.lineHeight = KATEX_LINE_HEIGHT;
    });

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

/** Wait for fonts and KaTeX layout before export. */
export async function waitForExportReady(root?: ParentNode): Promise<void> {
  await document.fonts.ready;
  await Promise.all(
    KATEX_FONT_FAMILIES.flatMap((family) => [
      document.fonts.load(`400 16px "${family}"`).catch(() => undefined),
      document.fonts.load(`700 16px "${family}"`).catch(() => undefined),
    ]),
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 200));

  if (root?.querySelector(".katex, [data-katex-raster='true']")) {
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
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
