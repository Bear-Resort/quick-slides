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

const CAPTURE_STYLE_SELECTORS = [
  ".slide-frame",
  ".slide-canvas",
  ".slide-primary-heading",
  ".slide-content-heading",
  ".slide-code-bg",
  ".slide-table-th",
  ".slide-table-td",
] as const;

function inlineComputedPaintStyles(element: HTMLElement): void {
  const computed = getComputedStyle(element);
  element.style.backgroundColor = computed.backgroundColor;
  if (computed.backgroundImage !== "none") {
    element.style.backgroundImage = computed.backgroundImage;
  }
  element.style.color = computed.color;
  element.style.borderColor = computed.borderColor;
}

function inlineTextColors(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".markdown-preview, .katex").forEach((element) => {
    element.style.color = getComputedStyle(element).color;
  });
}

function getExportPageRoot(root: HTMLElement): HTMLElement {
  if (root.classList.contains("export-slide-page")) {
    return root;
  }
  return root.querySelector<HTMLElement>(".export-slide-page") ?? root;
}

/** Wait for fonts and KaTeX layout before rasterizing a slide. */
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

  if (root?.querySelector(".katex")) {
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
  }
}

/** Inline resolved RGB styles and flatten transforms so html2canvas matches the preview. */
export function prepareSlideForCapture(root: HTMLElement): HTMLElement {
  const pageRoot = getExportPageRoot(root);
  const captureTarget =
    pageRoot.querySelector<HTMLElement>(".slide-canvas") ?? pageRoot;

  captureTarget.style.width = `${SLIDE_WIDTH}px`;
  captureTarget.style.height = `${SLIDE_HEIGHT}px`;

  const paintTargets = new Set<HTMLElement>([captureTarget]);
  for (const selector of CAPTURE_STYLE_SELECTORS) {
    pageRoot.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      paintTargets.add(element);
    });
  }
  paintTargets.forEach(inlineComputedPaintStyles);
  inlineTextColors(pageRoot);

  pageRoot.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    if (element.style.transform && element.style.transform !== "none") {
      element.style.transform = "none";
      element.style.width = "100%";
    }
  });

  pageRoot.querySelectorAll<HTMLElement>(".katex-display").forEach((element) => {
    element.style.display = "block";
    element.style.textAlign = "center";
    element.style.width = "100%";
  });

  return captureTarget;
}

export function getCaptureBackgroundColor(target: HTMLElement): string {
  const bg = getComputedStyle(target).backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
    return "#ffffff";
  }
  return bg;
}

export { SLIDE_HEIGHT, SLIDE_WIDTH };
