import { getKatexSource, isKatexDisplay } from "@/lib/exportCapture";

const MATHJAX_SCRIPT = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
const EXPORT_MATH_ATTR = "data-katex-raster";
/** Bump when MathJax init options change so cached instances are discarded. */
const MATHJAX_EXPORT_CONFIG = "svg-dataurl-v2";
const MATHJAX_LOAD_TIMEOUT_MS = 8_000;
const EQUATION_TIMEOUT_MS = 4_000;

type MathJaxGlobal = {
  startup: {
    promise: Promise<void>;
    defaultReady: () => void;
    defaultPageReady: () => Promise<void>;
  };
  tex2svg: (tex: string, options: { display: boolean }) => HTMLElement;
};

declare global {
  interface Window {
    MathJax?: MathJaxGlobal & Record<string, unknown>;
  }
}

let mathJaxReady: Promise<MathJaxGlobal | null> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`);
    }),
  ]);
}

function getMathReplacementTarget(mathEl: HTMLElement): HTMLElement {
  const displayWrapper = mathEl.closest(".katex-display");
  if (displayWrapper instanceof HTMLElement && displayWrapper !== mathEl) {
    return displayWrapper;
  }
  return mathEl;
}

function loadScript(src: string, datasetKey: string): Promise<void> {
  // dataset.mathjaxExport → attribute data-mathjax-export
  const dataAttr = datasetKey.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-${dataAttr}="true"]`,
  );

  if (existing) {
    if (existing.dataset.loaded === "true") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset[datasetKey] = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function configureMathJax(): void {
  window.MathJax = {
    startup: {
      ready: () => {
        window.MathJax?.startup.defaultReady();
      },
      pageReady: () => Promise.resolve(),
    },
    options: {
      enableAssistiveMml: false,
      menuOptions: {
        settings: {
          assistiveMml: false,
        },
      },
    },
    svg: {
      fontCache: "none",
    },
  } as unknown as MathJaxGlobal;
}

async function waitForTex2Svg(): Promise<MathJaxGlobal> {
  const deadline = Date.now() + MATHJAX_LOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const mathJax = window.MathJax;
    if (typeof mathJax?.tex2svg === "function") {
      return mathJax;
    }
    await sleep(40);
  }
  throw new Error("MathJax tex2svg not available after load");
}

async function loadMathJax(): Promise<MathJaxGlobal | null> {
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-mathjax-export="true"]',
  );
  const configMatches =
    existingScript?.dataset.mathjaxConfig === MATHJAX_EXPORT_CONFIG;

  if (configMatches && typeof window.MathJax?.tex2svg === "function") {
    return window.MathJax;
  }

  existingScript?.remove();
  delete window.MathJax;

  try {
    configureMathJax();
    await withTimeout(
      loadScript(MATHJAX_SCRIPT, "mathjaxExport"),
      MATHJAX_LOAD_TIMEOUT_MS,
      "MathJax script load",
    );
    const loadedScript = document.querySelector<HTMLScriptElement>(
      'script[data-mathjax-export="true"]',
    );
    if (loadedScript) {
      loadedScript.dataset.mathjaxConfig = MATHJAX_EXPORT_CONFIG;
    }

    const mathJax = window.MathJax as MathJaxGlobal | undefined;
    const startupPromise = mathJax?.startup?.promise;
    if (startupPromise) {
      await withTimeout(startupPromise, MATHJAX_LOAD_TIMEOUT_MS, "MathJax startup");
    }

    return await waitForTex2Svg();
  } catch (error) {
    console.warn("MathJax failed to load for PDF export:", error);
    return null;
  }
}

async function ensureMathJaxReady(): Promise<MathJaxGlobal | null> {
  if (!mathJaxReady) {
    mathJaxReady = loadMathJax().catch((error) => {
      mathJaxReady = null;
      console.warn("MathJax export init failed:", error);
      return null;
    });
  }

  return mathJaxReady;
}

function stripAssistiveMathml(node: ParentNode): void {
  node
    .querySelectorAll<HTMLElement>("mjx-assistive-mml, .mjx-assistive-mml")
    .forEach((el) => {
      el.remove();
    });
}

function applySvgColor(svg: SVGElement, color: string): void {
  svg.setAttribute("color", color);
  svg.style.color = color;

  for (const element of svg.querySelectorAll<SVGElement>("*")) {
    if (element.getAttribute("fill") === "currentColor") {
      element.setAttribute("fill", color);
    }
    if (element.getAttribute("stroke") === "currentColor") {
      element.setAttribute("stroke", color);
    }
  }
}

/** Prefer SVG data-URL images — much faster than canvas PNG, and html2canvas draws them cleanly. */
function svgElementToImage(
  svg: SVGElement,
  width: number,
  height: number,
  isDisplay: boolean,
  verticalAlign?: string,
): HTMLImageElement {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  img.setAttribute(EXPORT_MATH_ATTR, "true");
  img.width = Math.max(1, Math.round(width));
  img.height = Math.max(1, Math.round(height));
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;

  if (isDisplay) {
    img.style.display = "block";
    img.style.margin = "0.35em auto";
    img.style.verticalAlign = "baseline";
  } else {
    img.style.display = "inline";
    img.style.verticalAlign =
      verticalAlign && verticalAlign !== "auto" ? verticalAlign : "baseline";
  }

  return img;
}

function resolveExportFontPx(mathEl: HTMLElement, computed: CSSStyleDeclaration): number {
  const parent = mathEl.parentElement;
  const parentFont =
    parent instanceof HTMLElement
      ? Number.parseFloat(getComputedStyle(parent).fontSize)
      : Number.NaN;
  const selfFont = Number.parseFloat(computed.fontSize);
  if (Number.isFinite(selfFont) && selfFont >= 10) return selfFont;
  if (Number.isFinite(parentFont) && parentFont > 0) return parentFont * 1.12;
  return 27;
}

/** Parse MathJax SVG width/height attrs (`2.5ex`, `12px`, bare numbers). */
function parseSvgLength(value: string | null, fontPx: number): number {
  if (!value) return 0;
  const trimmed = value.trim();
  const ex = /^([\d.]+)\s*ex$/i.exec(trimmed);
  if (ex) {
    // CSS 1ex ≈ x-height; MathJax sizes track the math font (~0.43–0.5em).
    return Number(ex[1]) * fontPx * 0.45;
  }
  const em = /^([\d.]+)\s*em$/i.exec(trimmed);
  if (em) return Number(em[1]) * fontPx;
  const px = /^([\d.]+)\s*px$/i.exec(trimmed);
  if (px) return Number(px[1]);
  const bare = Number.parseFloat(trimmed);
  return Number.isFinite(bare) ? bare : 0;
}

function measureMathJaxSvg(
  svg: SVGElement,
  mjNode: HTMLElement,
  fontPx: number,
): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  let width = Math.max(rect.width, svg.clientWidth, 0);
  let height = Math.max(rect.height, svg.clientHeight, 0);

  if (width < 2 || height < 2) {
    width = Math.max(
      width,
      parseSvgLength(svg.getAttribute("width"), fontPx),
      mjNode.offsetWidth,
      mjNode.scrollWidth,
    );
    height = Math.max(
      height,
      parseSvgLength(svg.getAttribute("height"), fontPx),
      mjNode.offsetHeight,
      mjNode.scrollHeight,
    );
  }

  if ((width < 2 || height < 2) && svg instanceof SVGSVGElement) {
    // MathJax viewBox units: 1000 ≈ 1em of the math font.
    const vb = svg.viewBox.baseVal;
    if (vb.width > 0) {
      width = Math.max(width, (vb.width / 1000) * fontPx);
      height = Math.max(height, (vb.height / 1000) * fontPx);
    }
  }

  return {
    // Never fall back to fontPx for width — that forced every equation into one slot.
    width: Math.max(width, 1),
    height: Math.max(height, fontPx * 0.5, 1),
  };
}

async function renderMathToImage(
  mathEl: HTMLElement,
  mathJax: MathJaxGlobal,
): Promise<HTMLImageElement> {
  const source = getKatexSource(mathEl);
  if (!source) {
    throw new Error("No TeX source on KaTeX node");
  }

  const computed = getComputedStyle(mathEl);
  const isDisplay = isKatexDisplay(mathEl);
  const fontPx = resolveExportFontPx(mathEl, computed);
  const fontSize = `${fontPx}px`;

  const mjNode = mathJax.tex2svg(source.tex, { display: source.displayMode });
  stripAssistiveMathml(mjNode);
  mjNode.style.color = computed.color;
  mjNode.style.fontSize = fontSize;
  mjNode.style.display = isDisplay ? "block" : "inline-block";
  mjNode.style.lineHeight = "1.2";

  const measureHost = document.createElement("div");
  measureHost.style.cssText =
    "position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none;line-height:1.2;white-space:nowrap;";
  measureHost.style.color = computed.color;
  measureHost.style.fontSize = fontSize;
  if (isDisplay) {
    measureHost.style.display = "block";
    measureHost.style.textAlign = "center";
    measureHost.style.whiteSpace = "normal";
  }
  measureHost.appendChild(mjNode);
  document.body.appendChild(measureHost);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const svg = mjNode.querySelector("svg");
  if (!(svg instanceof SVGElement)) {
    measureHost.remove();
    throw new Error("MathJax did not produce SVG output");
  }

  const { width: mjWidth, height: mjHeight } = measureMathJaxSvg(
    svg,
    mjNode,
    fontPx,
  );
  const verticalAlign =
    svg.style.verticalAlign ||
    getComputedStyle(svg).verticalAlign ||
    mjNode.style.verticalAlign ||
    undefined;
  measureHost.remove();

  applySvgColor(svg, computed.color);
  return svgElementToImage(svg, mjWidth, mjHeight, isDisplay, verticalAlign);
}

/** Replace KaTeX HTML with MathJax SVG images so html2canvas keeps baselines intact. */
export async function replaceMathEquationsForCapture(root: ParentNode): Promise<void> {
  const mathNodes = Array.from(root.querySelectorAll<HTMLElement>(".katex"));
  if (mathNodes.length === 0) return;

  const mathJax = await ensureMathJaxReady();
  if (!mathJax) {
    console.warn("Skipping MathJax equation rasterization; using KaTeX HTML fallback");
    return;
  }

  // One replacement per equation (display wrappers share a single .katex child).
  const seenTargets = new Set<HTMLElement>();

  await Promise.all(
    mathNodes.map(async (mathEl) => {
      if (!mathEl.isConnected) return;
      const target = getMathReplacementTarget(mathEl);
      if (seenTargets.has(target)) return;
      seenTargets.add(target);

      try {
        const img = await withTimeout(
          renderMathToImage(mathEl, mathJax),
          EQUATION_TIMEOUT_MS,
          "Equation render",
        );
        if (target.isConnected) {
          target.replaceWith(img);
        }
      } catch (error) {
        console.warn("MathJax export rendering failed; keeping KaTeX HTML:", error);
      }
    }),
  );
}
