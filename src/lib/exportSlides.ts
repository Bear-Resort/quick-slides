import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DeckProvider } from "@/context/DeckContext";
import { ExportSlidePage, SLIDE_HEIGHT, SLIDE_WIDTH } from "@/components/ExportSlidePage";
import {
  getCaptureBackgroundColor,
  inlineColumnStylesForCapture,
  prepareKatexForCapture,
  prepareSlideForCapture,
  waitForCaptureImages,
  waitForExportReady,
  remeasureSlideFitContent,
  waitForSlideFitContent,
} from "@/lib/exportCapture";
import {
  clearExportImageCache,
  embedImagesForExport,
  embedUrlsInCss,
  revealLoadedImagesForCapture,
  type ExportImageOptions,
} from "@/lib/exportImages";
import { replaceMathEquationsForCapture } from "@/lib/exportMathJax";
import { resolveDeckImageSrc } from "@/lib/library/deckImages";
import { getLanguage, type Language } from "@/lib/language";
import { getExportBasename } from "@/lib/presentationFilename";
import { splitSlides } from "@/lib/slides";
import {
  getSlideThemeAttributes,
  slideColorModeClass,
  type SlideColorMode,
  type SlideThemeId,
} from "@/lib/slideThemes";

const EXPORT_MOUNT_ID = "quick-slides-export-mount";
const PDF_CAPTURE_SCALE = 1.5;
const PDF_JPEG_QUALITY = 0.92;

async function waitForRender(root?: ParentNode): Promise<void> {
  await waitForExportReady(root, { quick: true });
}

function collectEmbeddedStyles(): string {
  const chunks: string[] = [];
  const seen = new Set<string>();

  const pushChunk = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    chunks.push(trimmed);
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.href) {
        const origin = window.location.origin;
        if (!sheet.href.startsWith(origin) && !sheet.href.startsWith("blob:")) {
          continue;
        }
      }
      for (const rule of Array.from(sheet.cssRules)) {
        pushChunk(rule.cssText);
      }
    } catch {
      const owner = sheet.ownerNode;
      if (owner instanceof HTMLStyleElement && owner.textContent) {
        pushChunk(owner.textContent);
      }
    }
  }

  return chunks.join("\n");
}

/** Standalone HTML viewer chrome — matches in-app present mode (no exit). */
const EXPORT_VIEWER_STYLES = `
html, body {
  margin: 0;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: #000;
  color: #fff;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.export-viewer {
  position: fixed;
  inset: 0;
  background: #000;
}
.export-viewer-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  /* Tight padding on narrow screens so the full 16:9 slide can fit. */
  padding: 2.75rem 0.5rem 4rem;
}
@media (min-width: 640px) {
  .export-viewer-stage {
    padding: 3.5rem 4.5rem;
  }
}
.export-slide {
  display: none;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
}
.export-slide.is-active {
  display: block;
}
.export-slide-page {
  position: absolute;
  left: 50%;
  top: 50%;
  /* Sized in JS; centered via translate + uniform scale so narrow viewports don't clip. */
  transform-origin: center center;
  -webkit-transform-origin: center center;
}
.export-viewer-counter {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.9);
  pointer-events: none;
  user-select: none;
}
.export-viewer-nav {
  position: absolute;
  bottom: 1.25rem;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
}
.export-viewer-nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.55);
}
.export-viewer-nav:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}
.export-viewer-nav svg {
  width: 1.25rem;
  height: 1.25rem;
}
.export-viewer-nav-prev {
  left: 1rem;
}
.export-viewer-nav-next {
  right: 1rem;
}
@media (min-width: 640px) {
  .export-viewer-nav-prev {
    left: 1.25rem;
  }
  .export-viewer-nav-next {
    right: 1.25rem;
  }
}
.export-annotate {
  position: absolute;
  inset: 0;
  z-index: 10;
  touch-action: none;
}
.export-annotate.is-idle {
  pointer-events: none;
}
.export-annotate.is-laser,
.export-annotate.is-draw {
  cursor: none;
}
.export-annotate canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.export-annotate-cursor {
  position: absolute;
  pointer-events: none;
  border-radius: 999px;
  transform: translate(-50%, -50%);
}
.export-annotate-cursor.is-laser {
  width: 1rem;
  height: 1rem;
  background: #ef4444;
  box-shadow:
    0 0 0 3px rgba(239, 68, 68, 0.35),
    0 0 18px 6px rgba(239, 68, 68, 0.75);
}
.export-annotate-cursor.is-eraser {
  border: 1px solid rgba(255, 255, 255, 0.55);
  background:
    radial-gradient(
      circle at 32% 28%,
      rgba(255, 255, 255, 0.55) 0%,
      rgba(255, 255, 255, 0.16) 42%,
      rgba(255, 255, 255, 0.08) 70%,
      rgba(255, 255, 255, 0.04) 100%
    );
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.65),
    inset 0 -1px 2px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.12),
    0 4px 14px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(10px) saturate(1.35);
  -webkit-backdrop-filter: blur(10px) saturate(1.35);
}
.export-annotate-cursor.is-pen {
  border: 1.5px solid color-mix(in srgb, var(--pen-ink) 70%, white 30%);
  background:
    radial-gradient(
      circle at 50% 50%,
      color-mix(in srgb, var(--pen-ink) 88%, white 12%) 0%,
      color-mix(in srgb, var(--pen-ink) 55%, transparent) 48%,
      rgba(255, 255, 255, 0.14) 100%
    );
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.55),
    inset 0 -1px 2px rgba(0, 0, 0, 0.16),
    0 0 0 1px rgba(255, 255, 255, 0.18),
    0 2px 8px color-mix(in srgb, var(--pen-ink) 35%, transparent);
  backdrop-filter: blur(8px) saturate(1.3);
  -webkit-backdrop-filter: blur(8px) saturate(1.3);
}
.slide-color-light .export-annotate-cursor.is-eraser {
  border-color: rgba(255, 255, 255, 0.78);
  background:
    radial-gradient(
      circle at 32% 28%,
      rgba(255, 255, 255, 0.82) 0%,
      rgba(255, 255, 255, 0.42) 42%,
      rgba(255, 255, 255, 0.22) 70%,
      rgba(255, 255, 255, 0.12) 100%
    );
}
.slide-color-light .export-annotate-cursor.is-pen {
  border-color: color-mix(in srgb, var(--pen-ink) 55%, white 45%);
  background:
    radial-gradient(
      circle at 50% 50%,
      color-mix(in srgb, var(--pen-ink) 92%, white 8%) 0%,
      color-mix(in srgb, var(--pen-ink) 45%, rgba(255, 255, 255, 0.55)) 52%,
      rgba(255, 255, 255, 0.4) 100%
    );
}
.export-toolbox-toggle {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
}
.export-toolbox-toggle:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.55);
}
.export-toolbox-toggle svg {
  width: 1rem;
  height: 1rem;
}
.export-toolbox {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  z-index: 20;
  display: none;
  align-items: center;
  gap: 0.25rem;
  transform: translateX(-50%);
  padding: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.export-toolbox.is-open {
  display: flex;
}
.export-toolbox-toggle.is-hidden {
  display: none;
}
.export-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}
.export-tool:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.export-tool.is-active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7);
}
.export-tool svg {
  width: 1rem;
  height: 1rem;
}
.export-pen-chip {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  background: rgba(255, 255, 255, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.slide-color-light .export-pen-chip {
  border-color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}
.export-pen-chip-white {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 0 1px rgba(0, 0, 0, 0.2);
}
.export-pen-chip-white svg {
  filter: drop-shadow(0 0 1.25px rgba(0, 0, 0, 0.85));
}
.export-tool-hide {
  margin-left: 0.125rem;
}
`;

const ICON_CHEVRON_LEFT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const ICON_CHEVRON_RIGHT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const ICON_CHEVRON_DOWN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const ICON_PEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>';
const ICON_POINTER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a1 1 0 0 0-.662.662l-1.884 6.124a.5.5 0 0 1-.947.063z"/></svg>';
const ICON_ERASER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>';
const ICON_TRASH =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>';

function buildExportViewerScript(colorMode: SlideColorMode): string {
  const isDark = colorMode === "dark";
  const penBlue = isDark ? "#93c5fd" : "#2563eb";
  const penRed = isDark ? "#fca5a5" : "#dc2626";
  const penBlack = isDark ? "#ffffff" : "#171717";

  return `
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll(".export-slide"));
  var index = 0;
  var counter = document.getElementById("counter");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var stage = document.getElementById("stage");
  var annotate = document.getElementById("annotate");
  var canvas = document.getElementById("annotate-canvas");
  var cursorEl = document.getElementById("annotate-cursor");
  var toolbox = document.getElementById("toolbox");
  var toolboxToggle = document.getElementById("toolbox-toggle");
  var tool = "none";
  var toolboxOpen = false;
  var strokesBySlide = {};
  var drawing = null;
  var ctx = canvas ? canvas.getContext("2d") : null;
  var PEN_WIDTH = 3.5;
  var PEN_CURSOR = 14;
  var ERASER_WIDTH = 28;
  var PEN_COLORS = {
    "pen-blue": "${penBlue}",
    "pen-red": "${penRed}",
    "pen-black": "${penBlack}"
  };

  function stageSize() {
    if (stage) {
      var rect = stage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { width: rect.width, height: rect.height };
      }
    }
    var vv = window.visualViewport;
    return {
      width: (vv && vv.width) || window.innerWidth,
      height: (vv && vv.height) || window.innerHeight
    };
  }

  function fitActiveSlide() {
    var active = slides[index];
    if (!active) return;
    var page = active.querySelector(".export-slide-page");
    if (!page) return;
    // Fit inside the slide slot (stage content box after padding).
    var width = active.clientWidth;
    var height = active.clientHeight;
    if (width <= 0 || height <= 0) {
      var size = stageSize();
      // Fall back to stage content box (exclude padding).
      var style = stage ? window.getComputedStyle(stage) : null;
      var padX = style
        ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
        : 0;
      var padY = style
        ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
        : 0;
      width = Math.max(1, size.width - padX);
      height = Math.max(1, size.height - padY);
    }
    var scale = Math.min(
      width / ${SLIDE_WIDTH},
      height / ${SLIDE_HEIGHT},
      1
    );
    // Absolute + translate keeps layout size from forcing overflow/clipping.
    page.style.position = "absolute";
    page.style.left = "50%";
    page.style.top = "50%";
    page.style.width = "${SLIDE_WIDTH}px";
    page.style.height = "${SLIDE_HEIGHT}px";
    page.style.maxWidth = "none";
    page.style.maxHeight = "none";
    page.style.transformOrigin = "center center";
    page.style.webkitTransformOrigin = "center center";
    var transform = "translate(-50%, -50%) scale(" + scale + ")";
    page.style.transform = transform;
    page.style.webkitTransform = transform;
  }

  function syncCanvas() {
    if (!annotate || !canvas || !ctx) return;
    var rect = annotate.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  function drawStroke(stroke) {
    if (!ctx || !stroke.points.length) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    if (stroke.kind === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (var i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    if (stroke.points.length === 1) {
      ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    if (!ctx || !canvas) return;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    var list = strokesBySlide[index] || [];
    for (var i = 0; i < list.length; i++) drawStroke(list[i]);
    if (drawing) drawStroke(drawing);
  }

  function pointFromEvent(e) {
    if (!annotate) return { x: 0, y: 0 };
    var rect = annotate.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function setCursor(point) {
    if (!cursorEl) return;
    if (!point || tool === "none") {
      cursorEl.hidden = true;
      return;
    }
    cursorEl.hidden = false;
    cursorEl.style.left = point.x + "px";
    cursorEl.style.top = point.y + "px";
    cursorEl.className = "export-annotate-cursor";
    if (tool === "pointer") {
      cursorEl.classList.add("is-laser");
    } else if (tool === "eraser") {
      cursorEl.classList.add("is-eraser");
      cursorEl.style.width = ERASER_WIDTH + "px";
      cursorEl.style.height = ERASER_WIDTH + "px";
      cursorEl.style.removeProperty("--pen-ink");
    } else if (PEN_COLORS[tool]) {
      cursorEl.classList.add("is-pen");
      cursorEl.style.width = PEN_CURSOR + "px";
      cursorEl.style.height = PEN_CURSOR + "px";
      cursorEl.style.setProperty("--pen-ink", PEN_COLORS[tool]);
    }
  }

  function updateAnnotateMode() {
    if (!annotate) return;
    annotate.classList.remove("is-idle", "is-laser", "is-draw");
    if (tool === "none") annotate.classList.add("is-idle");
    else if (tool === "pointer") annotate.classList.add("is-laser");
    else annotate.classList.add("is-draw");
  }

  function setTool(next) {
    tool = next;
    drawing = null;
    updateAnnotateMode();
    Array.prototype.forEach.call(document.querySelectorAll(".export-tool[data-tool]"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tool") === tool);
    });
    if (tool === "none") setCursor(null);
  }

  function openToolbox() {
    toolboxOpen = true;
    if (toolbox) toolbox.classList.add("is-open");
    if (toolboxToggle) toolboxToggle.classList.add("is-hidden");
    if (tool === "none") setTool("pointer");
  }

  function closeToolbox() {
    toolboxOpen = false;
    if (toolbox) toolbox.classList.remove("is-open");
    if (toolboxToggle) toolboxToggle.classList.remove("is-hidden");
    setTool("none");
  }

  function clearPage() {
    strokesBySlide[index] = [];
    drawing = null;
    redraw();
  }

  function render() {
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === index);
    });
    if (counter) {
      counter.textContent = (index + 1) + "/" + slides.length;
    }
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
    fitActiveSlide();
    syncCanvas();
    drawing = null;
    setCursor(null);
  }

  function next() {
    if (index < slides.length - 1) {
      index += 1;
      render();
    }
  }

  function prev() {
    if (index > 0) {
      index -= 1;
      render();
    }
  }

  if (annotate) {
    annotate.addEventListener("pointerdown", function (e) {
      if (tool === "none" || tool === "pointer") return;
      if (e.button !== 0) return;
      annotate.setPointerCapture(e.pointerId);
      var point = pointFromEvent(e);
      setCursor(point);
      if (tool === "eraser") {
        drawing = { kind: "eraser", color: "transparent", width: ERASER_WIDTH, points: [point] };
      } else {
        drawing = { kind: "pen", color: PEN_COLORS[tool], width: PEN_WIDTH, points: [point] };
      }
      redraw();
    });
    annotate.addEventListener("pointermove", function (e) {
      if (tool === "none") return;
      var point = pointFromEvent(e);
      if (tool === "pointer" || tool === "eraser" || PEN_COLORS[tool]) setCursor(point);
      if (tool === "pointer" || !drawing) return;
      var last = drawing.points[drawing.points.length - 1];
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1.25) return;
      drawing.points.push(point);
      redraw();
    });
    function endStroke(e) {
      if (annotate.hasPointerCapture && annotate.hasPointerCapture(e.pointerId)) {
        annotate.releasePointerCapture(e.pointerId);
      }
      if (!drawing) return;
      if (!strokesBySlide[index]) strokesBySlide[index] = [];
      strokesBySlide[index].push(drawing);
      drawing = null;
      redraw();
    }
    annotate.addEventListener("pointerup", endStroke);
    annotate.addEventListener("pointercancel", endStroke);
    annotate.addEventListener("pointerleave", function () {
      if (tool === "pointer" || tool === "eraser" || PEN_COLORS[tool]) setCursor(null);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      index = 0;
      render();
    } else if (e.key === "End") {
      e.preventDefault();
      index = slides.length - 1;
      render();
    }
  });

  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);
  if (toolboxToggle) toolboxToggle.addEventListener("click", openToolbox);
  Array.prototype.forEach.call(document.querySelectorAll(".export-tool[data-tool]"), function (btn) {
    btn.addEventListener("click", function () {
      setTool(btn.getAttribute("data-tool"));
    });
  });
  var clearBtn = document.getElementById("clear-page");
  if (clearBtn) clearBtn.addEventListener("click", clearPage);
  var hideBtn = document.getElementById("toolbox-hide");
  if (hideBtn) hideBtn.addEventListener("click", closeToolbox);

  window.addEventListener("resize", function () {
    fitActiveSlide();
    syncCanvas();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      fitActiveSlide();
      syncCanvas();
    });
  }

  updateAnnotateMode();
  render();
})();
`;
}

async function renderSlidesForExport(
  markdown: string,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
  exportImages: ExportImageOptions,
  onSlide: (element: HTMLElement, index: number) => Promise<void>,
): Promise<void> {
  const slides = splitSlides(markdown);
  const existing = document.getElementById(EXPORT_MOUNT_ID);
  existing?.remove();

  const mount = document.createElement("div");
  mount.id = EXPORT_MOUNT_ID;
  mount.className = [
    slideColorModeClass(colorMode),
    colorMode === "dark" ? "night" : "",
  ]
    .filter(Boolean)
    .join(" ");
  mount.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1280px;height:720px;pointer-events:none;overflow:hidden;";
  document.body.appendChild(mount);

  const root = createRoot(mount);
  const { deckHandle, deckId } = exportImages;

  try {
    for (let i = 0; i < slides.length; i++) {
      const slidePage = createElement(ExportSlidePage, {
        markdown: slides[i] ?? "",
        theme,
        colorMode,
        slideIndex: i,
      });

      let tree: ReactNode = slidePage;
      if (deckHandle && deckId) {
        tree = createElement(DeckProvider, {
          folderName: deckId,
          handle: deckHandle,
          resolveImageSrc: (src: string) =>
            resolveDeckImageSrc(deckHandle, deckId, src),
          storeImage: async () => {
            throw new Error("Export is read-only");
          },
          children: slidePage,
        });
      }

      root.render(tree);
      await waitForRender(mount);
      const slideEl = mount.firstElementChild;
      if (!(slideEl instanceof HTMLElement)) {
        throw new Error("Failed to render slide for export");
      }
      await onSlide(slideEl, i);
    }
  } finally {
    root.unmount();
    mount.remove();
  }
}

async function prepareSlideElementForExport(
  slideEl: HTMLElement,
  exportImages: ExportImageOptions,
): Promise<HTMLElement> {
  const pageRoot = slideEl.classList.contains("export-slide-page")
    ? slideEl
    : slideEl.querySelector<HTMLElement>(".export-slide-page") ?? slideEl;
  pageRoot.classList.add("export-pdf-capture");
  const captureScope = pageRoot;

  await waitForSlideFitContent(captureScope);
  // Size KaTeX, then rasterize to MathJax SVG <img> before style inlining —
  // html2canvas scrambles KaTeX HTML baselines (operators as superscripts, etc.).
  prepareKatexForCapture(captureScope);
  await replaceMathEquationsForCapture(captureScope);
  prepareSlideForCapture(slideEl);
  await waitForExportReady(captureScope, { quick: true });
  await waitForCaptureImages(captureScope);
  revealLoadedImagesForCapture(captureScope);
  await embedImagesForExport(captureScope, exportImages);
  await remeasureSlideFitContent(captureScope);
  inlineColumnStylesForCapture(captureScope);

  return pageRoot;
}

/** Print/PDF embeds: JPEG for photos; stickers get small WebP+alpha in embedImagesForExport. */
const PRINT_PDF_IMAGE_OPTIONS = {
  maxEmbedDimension: 960,
  jpegQuality: 0.72,
  forceJpeg: true,
  skipFonts: true,
} as const;

/**
 * Prepare a slide for Chrome print-to-PDF: keep real KaTeX/text (selectable).
 * Embeds images; does not rasterize math.
 */
async function prepareSlideElementForPrintPdf(
  slideEl: HTMLElement,
  exportImages: ExportImageOptions,
): Promise<HTMLElement> {
  const pageRoot = slideEl.classList.contains("export-slide-page")
    ? slideEl
    : slideEl.querySelector<HTMLElement>(".export-slide-page") ?? slideEl;
  pageRoot.classList.add("export-pdf-page");
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

  await waitForSlideFitContent(pageRoot);
  await waitForExportReady(pageRoot);
  await waitForCaptureImages(pageRoot);
  revealLoadedImagesForCapture(pageRoot);
  await embedImagesForExport(pageRoot, {
    ...exportImages,
    ...PRINT_PDF_IMAGE_OPTIONS,
  });
  // Remeasure after fonts/images settle — early measure often jumps to 3 clipped cols.
  await remeasureSlideFitContent(pageRoot);
  inlineColumnStylesForCapture(pageRoot);
  await waitForExportReady(pageRoot);

  pageRoot.querySelectorAll<HTMLElement>(".katex-mathml").forEach((el) => {
    el.style.position = "absolute";
    el.style.clip = "rect(1px, 1px, 1px, 1px)";
    el.style.width = "1px";
    el.style.height = "1px";
    el.style.overflow = "hidden";
    el.style.whiteSpace = "nowrap";
  });

  return pageRoot;
}

const PDF_PRINT_STYLES = `
@page {
  size: ${SLIDE_WIDTH}px ${SLIDE_HEIGHT}px;
  margin: 0;
}
html, body {
  margin: 0;
  padding: 0;
  width: ${SLIDE_WIDTH}px;
  background: #fff;
  /* Match live preview (index.css / index.html). KaTeX keeps its own faces. */
  font-family: "Noto Serif SC", serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.export-pdf-page {
  font-family: "Noto Serif SC", serif;
}
.export-pdf-page {
  width: ${SLIDE_WIDTH}px;
  height: ${SLIDE_HEIGHT}px;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}
.export-pdf-page:last-child {
  page-break-after: auto;
  break-after: auto;
}
/* Regular theme: pure white/black like the live preview — no app-chrome gray fills. */
body.slide-theme-regular,
.slide-theme-regular.export-pdf-page,
.slide-theme-regular .slide-frame,
.slide-theme-regular .slide-canvas {
  background: #ffffff !important;
  background-image: none !important;
  box-shadow: none !important;
}
body.slide-color-dark.slide-theme-regular,
.slide-color-dark.slide-theme-regular.export-pdf-page,
.slide-color-dark.slide-theme-regular .slide-frame,
.slide-color-dark.slide-theme-regular .slide-canvas,
body.slide-color-dark.slide-theme-regular .slide-frame,
body.slide-color-dark.slide-theme-regular .slide-canvas {
  background: #18181b !important;
  background-image: none !important;
}
.slide-theme-regular .slide-content-heading,
.slide-theme-regular .slide-primary-heading {
  background: transparent !important;
  background-image: none !important;
}
/* Page chrome */
.slide-frame,
.slide-canvas,
.slide-canvas > div {
  width: ${SLIDE_WIDTH}px !important;
  max-width: ${SLIDE_WIDTH}px !important;
  height: ${SLIDE_HEIGHT}px !important;
  box-sizing: border-box !important;
}
.slide-content-layout {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  width: ${SLIDE_WIDTH}px !important;
  max-width: ${SLIDE_WIDTH}px !important;
  box-sizing: border-box !important;
  padding-left: 48px !important;
  padding-right: 48px !important;
}
/* Text-only body must span the full content width (not an image-column half). */
[data-slide-layout="content"] > .slide-content-slide-body,
[data-slide-layout="content"] .slide-fit-content-body,
[data-slide-layout="content"] .slide-fit-content-body > div {
  width: ${SLIDE_WIDTH - 96}px !important;
  max-width: ${SLIDE_WIDTH - 96}px !important;
  min-width: ${SLIDE_WIDTH - 96}px !important;
  align-self: stretch !important;
  overflow: visible !important;
  box-sizing: border-box !important;
}
/* Kill CSS multi-column — text overflow uses the same 2-col grid as image+text. */
.slide-content-overflow .markdown-preview.slide-content,
.markdown-preview.slide-content[data-slide-two-col="true"] {
  columns: auto !important;
  column-count: auto !important;
  column-width: auto !important;
  column-gap: normal !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}
/* Shared 2-column grid: image+text row AND text-only overflow panes. */
.slide-sticker-shift-target.grid,
.slide-text-two-col,
.slide-two-col-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  column-gap: 2.5rem !important;
  align-items: start !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}
.slide-two-col-pane {
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.slide-content-overflow .markdown-preview.slide-content > :is(ul, ol, p) {
  break-inside: auto;
  -webkit-column-break-inside: auto;
}
.slide-content-overflow .markdown-preview.slide-content li {
  break-inside: auto;
  -webkit-column-break-inside: auto;
}
.slide-content-overflow .katex-display {
  display: block;
  width: 100%;
  text-align: center;
  break-inside: avoid;
  -webkit-column-break-inside: avoid;
}
.slide-content-overflow .katex-display > .katex,
.katex-display > .katex {
  display: inline-block;
  width: auto;
  max-width: none;
}
.katex-display {
  width: auto;
  max-width: none;
}
.katex,
.katex .katex-html,
.katex .base {
  max-width: none !important;
}
.katex .katex-mathml,
.katex .katex-mathml math {
  display: none !important;
}
.slide-image-caption {
  display: block;
  text-align: center;
  color: inherit;
  opacity: 0.75;
}
img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
}
.slide-image-panel img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
`;

/** Soft caps so Browserless free tier stays comfortable (compressed images keep payloads down). */
const SELECTABLE_PDF_MAX_SLIDES = 25;
const SELECTABLE_PDF_MAX_HTML_CHARS = 4_000_000;
const SELECTABLE_PDF_MAX_CSS_CHARS = 800_000;

function buildPdfPrintDocument(
  slideFragments: string[],
  colorMode: SlideColorMode,
  slideThemeId: SlideThemeId,
  embeddedStyles: string,
  documentTitle: string,
): string {
  const nightClass = colorMode === "dark" ? " night" : "";
  const slideThemeClass = getSlideThemeAttributes(slideThemeId).className;
  const colorModeClass = slideColorModeClass(colorMode);
  const pages = slideFragments.join("\n");
  const styles =
    embeddedStyles.length > SELECTABLE_PDF_MAX_CSS_CHARS
      ? embeddedStyles.slice(0, SELECTABLE_PDF_MAX_CSS_CHARS)
      : embeddedStyles;

  // Same Noto Serif SC as the live preview (index.html). Browserless must be
  // allowed time to download the face — see waitForTimeout in convex/http.ts.
  return `<!DOCTYPE html>
<html lang="en" class="${nightClass.trim()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${SLIDE_WIDTH}">
  <title>${escapeHtml(documentTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css" crossorigin="anonymous">
  <style>
${styles}
${PDF_PRINT_STYLES}
  </style>
</head>
<body class="${slideThemeClass} ${colorModeClass}">
${pages}
</body>
</html>`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getConvexExportPdfUrl(): string | null {
  const site = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)?.trim();
  if (site) {
    return `${site.replace(/\/$/, "")}/export-pdf`;
  }
  const proxy = (import.meta.env.VITE_GITHUB_OAUTH_PROXY as string | undefined)?.trim();
  if (proxy?.includes(".convex.site")) {
    return `${proxy.replace(/\/github-oauth\/?$/, "")}/export-pdf`;
  }
  return null;
}

export class SelectablePdfEntitlementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SelectablePdfEntitlementError";
    this.code = code;
  }
}

async function renderPdfViaConvexBackend(
  html: string,
  githubToken: string,
): Promise<Blob> {
  const endpoint = getConvexExportPdfUrl();
  if (!endpoint) {
    throw new Error("PDF_BACKEND_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  // Client abort before free-tier 60s session wall.
  const timeoutId = window.setTimeout(() => controller.abort(), 55_000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/pdf",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({ html }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("PDF export timed out waiting for the server");
    }
    throw new Error(
      error instanceof Error
        ? `PDF export network error: ${error.message}`
        : "PDF export network error",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status === 503) {
    throw new Error("PDF_BACKEND_NOT_CONFIGURED");
  }

  if (!response.ok) {
    let code = `http_${response.status}`;
    let detail = `PDF export failed (${response.status})`;
    try {
      const json = (await response.json()) as {
        error_description?: string;
        error?: string;
      };
      code = json.error || code;
      detail = json.error_description || json.error || detail;
    } catch {
      // ignore
    }
    if (response.status === 401 || response.status === 403) {
      throw new SelectablePdfEntitlementError(code, detail);
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("PDF export returned an empty file");
  }
  return blob;
}

/**
 * Selectable-text PDF via Convex → Browserless (tight 1280×720, no print chrome).
 * Requires a GitHub token (quota-gated). Technical size/timeout failures fall back
 * to image PDF; entitlement denials throw SelectablePdfEntitlementError.
 */
export async function downloadSlidesPdf(
  markdown: string,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
  filename: string,
  deckHandle: FileSystemDirectoryHandle | null = null,
  deckId: string | null = null,
  githubToken?: string | null,
): Promise<void> {
  const language = getLanguage();
  const exportBasename = getExportBasename(filename, language);
  const documentTitle = filename.trim() || exportBasename;
  const exportImages: ExportImageOptions = { deckHandle, deckId };
  const slideCount = splitSlides(markdown).length;
  const slideFragments: string[] = [];
  const token = githubToken?.trim() ?? "";

  if (!token) {
    throw new SelectablePdfEntitlementError(
      "unauthorized",
      "Sign in with GitHub to download selectable-text PDF.",
    );
  }

  const useImageFallback = async (reason: string) => {
    console.warn(`${reason}; using image PDF instead.`);
    await downloadSlidesPdfImage(
      markdown,
      theme,
      colorMode,
      filename,
      deckHandle,
      deckId,
    );
  };

  try {
    if (!getConvexExportPdfUrl()) {
      await useImageFallback("Selectable PDF backend URL is not configured");
      return;
    }

    if (slideCount > SELECTABLE_PDF_MAX_SLIDES) {
      await useImageFallback(
        `Deck has ${slideCount} slides (limit ${SELECTABLE_PDF_MAX_SLIDES} for free-tier selectable PDF)`,
      );
      return;
    }

    await renderSlidesForExport(
      markdown,
      theme,
      colorMode,
      exportImages,
      async (slideEl) => {
        const pageRoot = await prepareSlideElementForPrintPdf(
          slideEl,
          exportImages,
        );
        slideFragments.push(pageRoot.outerHTML);
      },
    );

    const embeddedStyles = await embedUrlsInCss(collectEmbeddedStyles(), {
      ...exportImages,
      ...PRINT_PDF_IMAGE_OPTIONS,
    });
    const html = buildPdfPrintDocument(
      slideFragments,
      colorMode,
      theme,
      embeddedStyles,
      documentTitle,
    );

    if (html.length > SELECTABLE_PDF_MAX_HTML_CHARS) {
      await useImageFallback(
        `Print HTML is ${html.length} chars (limit ${SELECTABLE_PDF_MAX_HTML_CHARS})`,
      );
      return;
    }

    try {
      const pdfBlob = await renderPdfViaConvexBackend(html, token);
      downloadBlob(pdfBlob, `${exportBasename}.pdf`);
    } catch (error) {
      if (error instanceof SelectablePdfEntitlementError) {
        throw error;
      }
      console.warn("Selectable PDF backend failed; using image PDF.", error);
      await downloadSlidesPdfImage(
        markdown,
        theme,
        colorMode,
        filename,
        deckHandle,
        deckId,
      );
    }
  } finally {
    clearExportImageCache();
  }
}

/** Silent PDF download via html2canvas-pro + jsPDF (image pages; works on mobile). */
export async function downloadSlidesPdfImage(
  markdown: string,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
  filename: string,
  deckHandle: FileSystemDirectoryHandle | null = null,
  deckId: string | null = null,
): Promise<void> {
  const language = getLanguage();
  const exportBasename = getExportBasename(filename, language);
  const exportImages: ExportImageOptions = { deckHandle, deckId };

  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [SLIDE_WIDTH, SLIDE_HEIGHT],
      hotfixes: ["px_scaling"],
    });

    await renderSlidesForExport(
      markdown,
      theme,
      colorMode,
      exportImages,
      async (slideEl, index) => {
        const pageRoot = await prepareSlideElementForExport(slideEl, exportImages);

        const slideCanvas = pageRoot.querySelector<HTMLElement>(".slide-canvas");
        if (!(slideCanvas instanceof HTMLElement)) {
          throw new Error("Slide canvas not found for PDF export");
        }

        if (index > 0) {
          pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], "landscape");
        }

        await rasterizeSlideToPdf(pdf, pageRoot, slideCanvas);
      },
    );

    pdf.save(`${exportBasename}.pdf`);
  } finally {
    clearExportImageCache();
  }
}

async function rasterizeSlideToPdf(
  pdf: import("jspdf").jsPDF,
  captureRoot: HTMLElement,
  slideCanvas: HTMLElement,
): Promise<void> {
  const html2canvasModule = await import("html2canvas-pro");
  const html2canvas =
    html2canvasModule.default ??
    html2canvasModule.html2canvas ??
    html2canvasModule;

  const backgroundColor = getCaptureBackgroundColor(slideCanvas);

  const canvas = await html2canvas(captureRoot, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    scale: PDF_CAPTURE_SCALE,
    useCORS: true,
    backgroundColor,
    foreignObjectRendering: false,
    logging: false,
  });

  const dataUrl = canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY);
  pdf.addImage(
    dataUrl,
    "JPEG",
    0,
    0,
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    undefined,
    "FAST",
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlDocument(
  slideFragments: string[],
  colorMode: SlideColorMode,
  slideThemeId: SlideThemeId,
  language: Language,
  embeddedStyles: string,
  documentTitle: string,
): string {
  const slidesHtml = slideFragments
    .map(
      (fragment, index) =>
        `<div class="export-slide${index === 0 ? " is-active" : ""}" data-index="${index}">${fragment}</div>`,
    )
    .join("\n");

  const nightClass = colorMode === "dark" ? " night" : "";
  const slideThemeClass = getSlideThemeAttributes(slideThemeId).className;
  const colorModeClass = slideColorModeClass(colorMode);
  const total = slideFragments.length;
  const viewerScript = buildExportViewerScript(colorMode);
  const penBlue = colorMode === "dark" ? "#93c5fd" : "#2563eb";
  const penRed = colorMode === "dark" ? "#fca5a5" : "#dc2626";
  const penBlack = colorMode === "dark" ? "#ffffff" : "#171717";
  const penBlackChipClass =
    colorMode === "dark" ? " export-pen-chip-white" : "";
  const penBlackLabel = colorMode === "dark" ? "White pen" : "Black pen";

  return `<!DOCTYPE html>
<html lang="${language}" class="${nightClass.trim()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(documentTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
${embeddedStyles}
${EXPORT_VIEWER_STYLES}
  </style>
</head>
<body>
  <div class="export-viewer slide-presenter ${slideThemeClass} ${colorModeClass}">
    <div id="counter" class="export-viewer-counter" aria-live="polite">1/${total}</div>
    <div id="stage" class="export-viewer-stage">
${slidesHtml}
      <div id="annotate" class="export-annotate is-idle">
        <canvas id="annotate-canvas"></canvas>
        <div id="annotate-cursor" class="export-annotate-cursor" hidden></div>
      </div>
    </div>
    <button type="button" id="prev" class="export-viewer-nav export-viewer-nav-prev" aria-label="Previous" disabled>
      ${ICON_CHEVRON_LEFT}
    </button>
    <button type="button" id="toolbox-toggle" class="export-toolbox-toggle" aria-label="Show annotation tools" title="Show annotation tools">
      ${ICON_PEN}
    </button>
    <div id="toolbox" class="export-toolbox" role="toolbar" aria-label="Annotation tools">
      <button type="button" class="export-tool" data-tool="pointer" aria-label="Red pointer" title="Red pointer">
        <span class="export-pen-chip" style="color:#ef4444">${ICON_POINTER}</span>
      </button>
      <button type="button" class="export-tool" data-tool="pen-blue" aria-label="Blue pen" title="Blue pen">
        <span class="export-pen-chip" style="color:${penBlue}">${ICON_PEN}</span>
      </button>
      <button type="button" class="export-tool" data-tool="pen-red" aria-label="Red pen" title="Red pen">
        <span class="export-pen-chip" style="color:${penRed}">${ICON_PEN}</span>
      </button>
      <button type="button" class="export-tool" data-tool="pen-black" aria-label="${penBlackLabel}" title="${penBlackLabel}">
        <span class="export-pen-chip${penBlackChipClass}" style="color:${penBlack}">${ICON_PEN}</span>
      </button>
      <button type="button" class="export-tool" data-tool="eraser" aria-label="Eraser" title="Eraser">
        ${ICON_ERASER}
      </button>
      <button type="button" id="clear-page" class="export-tool" aria-label="Clear drawings on this slide" title="Clear drawings on this slide">
        ${ICON_TRASH}
      </button>
      <button type="button" id="toolbox-hide" class="export-tool export-tool-hide" aria-label="Hide annotation tools" title="Hide annotation tools">
        ${ICON_CHEVRON_DOWN}
      </button>
    </div>
    <button type="button" id="next" class="export-viewer-nav export-viewer-nav-next" aria-label="Next"${total <= 1 ? " disabled" : ""}>
      ${ICON_CHEVRON_RIGHT}
    </button>
  </div>
  <script>${viewerScript}<\/script>
</body>
</html>`;
}

export async function downloadSlidesHtml(
  markdown: string,
  theme: SlideThemeId,
  colorMode: SlideColorMode,
  filename: string,
  deckHandle: FileSystemDirectoryHandle | null = null,
  deckId: string | null = null,
): Promise<void> {
  const slideFragments: string[] = [];
  const language = getLanguage();
  const exportBasename = getExportBasename(filename, language);
  const documentTitle = filename.trim() || exportBasename;
  const exportImages: ExportImageOptions = { deckHandle, deckId };

  try {
    await renderSlidesForExport(
      markdown,
      theme,
      colorMode,
      exportImages,
      async (slideEl) => {
        await prepareSlideElementForExport(slideEl, exportImages);
        slideFragments.push(slideEl.outerHTML);
      },
    );

    const embeddedStyles = await embedUrlsInCss(collectEmbeddedStyles(), exportImages);
    const html = buildHtmlDocument(
      slideFragments,
      colorMode,
      theme,
      language,
      embeddedStyles,
      documentTitle,
    );
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${exportBasename}.html`);
  } finally {
    clearExportImageCache();
  }
}
