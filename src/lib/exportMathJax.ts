import { getKatexSource, isKatexDisplay } from "@/lib/exportCapture";

const MATHJAX_SCRIPT = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
const EXPORT_MATH_ATTR = "data-katex-raster";
/** Bump when MathJax init options change so cached instances are discarded. */
const MATHJAX_EXPORT_CONFIG = "local-font-v1";
const RASTER_SCALE = 3;
const MATHJAX_LOAD_TIMEOUT_MS = 20_000;
const SVG_IMAGE_TIMEOUT_MS = 8_000;

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
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-${datasetKey}="true"]`,
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
    tex: {
      packages: { "[+]": ["ams", "noerrors", "noundefined"] },
    },
    svg: {
      fontCache: "local",
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
    await sleep(50);
  }
  throw new Error("MathJax tex2svg not available after load");
}

async function loadMathJax(): Promise<MathJaxGlobal | null> {
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-mathjax-export="true"]',
  );
  const configMatches =
    existingScript?.dataset.mathjaxConfig === MATHJAX_EXPORT_CONFIG;

  if (
    configMatches &&
    typeof window.MathJax?.tex2svg === "function"
  ) {
    return window.MathJax;
  }

  existingScript?.remove();
  delete window.MathJax;
  mathJaxReady = null;

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

/** Remove hidden accessibility markup that html2canvas may still paint. */
function stripAssistiveMathml(node: ParentNode): void {
  node.querySelectorAll<HTMLElement>("mjx-assistive-mml, .mjx-assistive-mml").forEach((el) => {
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

async function svgElementToPngImage(
  svg: SVGElement,
  width: number,
  height: number,
  isDisplay: boolean,
): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * RASTER_SCALE));
  canvas.height = Math.max(1, Math.ceil(height * RASTER_SCALE));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  const svgImage = new Image();
  svgImage.decoding = "async";
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      svgImage.onload = () => resolve();
      svgImage.onerror = () => reject(new Error("Failed to decode MathJax SVG"));
      svgImage.src = dataUrl;
    }),
    SVG_IMAGE_TIMEOUT_MS,
    "MathJax SVG decode",
  );

  ctx.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/png");
  img.alt = "";
  img.setAttribute(EXPORT_MATH_ATTR, "true");
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;

  if (isDisplay) {
    img.style.display = "block";
    img.style.margin = "0 auto";
  } else {
    img.style.display = "inline-block";
    img.style.verticalAlign = "middle";
  }

  if (img.decode) {
    await withTimeout(
      img.decode().catch(() => undefined),
      SVG_IMAGE_TIMEOUT_MS,
      "PNG decode",
    );
  }

  return img;
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

  const mjNode = mathJax.tex2svg(source.tex, { display: source.displayMode });
  stripAssistiveMathml(mjNode);
  mjNode.style.color = computed.color;
  mjNode.style.fontSize = computed.fontSize;

  const measureHost = document.createElement("div");
  measureHost.style.cssText =
    "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;line-height:1.2;";
  measureHost.style.color = computed.color;
  measureHost.style.fontSize = computed.fontSize;
  if (isDisplay) {
    measureHost.style.display = "block";
    measureHost.style.textAlign = "center";
    measureHost.style.width = "100%";
  }
  measureHost.appendChild(mjNode);
  document.body.appendChild(measureHost);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const width = Math.max(mjNode.offsetWidth, mjNode.scrollWidth, 1);
  const height = Math.max(mjNode.offsetHeight, mjNode.scrollHeight, 1);
  measureHost.remove();

  const svg = mjNode.querySelector("svg");
  if (!(svg instanceof SVGElement)) {
    throw new Error("MathJax did not produce SVG output");
  }

  applySvgColor(svg, computed.color);
  return svgElementToPngImage(svg, width, height, isDisplay);
}

/** Replace KaTeX HTML with MathJax SVG rasterized to PNG for PDF capture. */
export async function replaceMathEquationsForCapture(root: ParentNode): Promise<void> {
  const mathNodes = Array.from(root.querySelectorAll<HTMLElement>(".katex"));
  if (mathNodes.length === 0) return;

  const mathJax = await ensureMathJaxReady();
  if (!mathJax) {
    console.warn("Skipping MathJax equation rasterization; using KaTeX HTML fallback");
    return;
  }

  for (const mathEl of mathNodes) {
    if (!mathEl.isConnected) continue;

    try {
      const img = await renderMathToImage(mathEl, mathJax);
      getMathReplacementTarget(mathEl).replaceWith(img);
    } catch (error) {
      console.warn("MathJax export rendering failed; keeping KaTeX HTML fallback:", error);
    }
  }
}
