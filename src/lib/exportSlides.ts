import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ExportSlidePage, SLIDE_HEIGHT, SLIDE_WIDTH } from "@/components/ExportSlidePage";
import {
  getCaptureBackgroundColor,
  prepareSlideForCapture,
  waitForExportReady,
} from "@/lib/exportCapture";
import { getLanguage, type Language } from "@/lib/language";
import { presenterUiCopy } from "@/lib/presenterUi";
import { splitSlides } from "@/lib/slides";
import { getSlideThemeAttributes, type SlideThemeId } from "@/lib/slideThemes";
import type { Theme } from "@/lib/theme";

const EXPORT_MOUNT_ID = "quick-slides-export-mount";

async function waitForRender(root?: ParentNode): Promise<void> {
  await waitForExportReady(root);
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

const PRESENTER_STYLES = `
html, body {
  margin: 0;
  height: 100%;
  min-height: 100vh;
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.export-presenter {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: -webkit-fill-available;
  background: var(--background, #fff);
  color: var(--foreground, #111);
}
.export-presenter-stage {
  flex: 1 1 0%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 1.5rem 2.5rem;
  overflow: hidden;
}
.export-slide {
  display: none;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
}
.export-slide.is-active {
  display: flex;
}
.export-slide-page {
  transform-origin: center center;
  -webkit-transform-origin: center center;
}
.presenter-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-top-width: 1px;
  border-top-style: solid;
}
.presenter-counter {
  flex-shrink: 0;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.presenter-nav {
  flex: 1 1 0%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-width: 0;
}
.presenter-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.presenter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.25rem;
  border-width: 1px;
  border-style: solid;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: background-color 0.15s ease;
}
.presenter-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}
.presenter-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.presenter-btn-nav {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}
.presenter-btn-icon {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  font-size: 0.875rem;
  font-weight: 700;
}
.presenter-btn-icon svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
.presenter-help {
  position: relative;
}
.presenter-help-tooltip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.5rem);
  display: none;
  width: max-content;
  max-width: 16rem;
  border: 1px solid var(--border, #ccc);
  border-radius: 0.375rem;
  background: var(--popover, #fff);
  color: var(--popover-foreground, #111);
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  white-space: normal;
  text-align: left;
}
.presenter-help:hover .presenter-help-tooltip,
.presenter-help:focus-within .presenter-help-tooltip {
  display: block;
}
.presenter-settings {
  position: relative;
}
.presenter-settings-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.5rem);
  z-index: 50;
  display: none;
  min-width: 12rem;
  overflow: hidden;
  border: 1px solid var(--border, #ccc);
  border-radius: 0.375rem;
  background: var(--popover, #fff);
  color: var(--popover-foreground, #111);
  padding: 0.25rem;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
.presenter-settings-menu.is-open {
  display: block;
}
.presenter-settings-label {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}
.presenter-settings-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  text-align: left;
  border-radius: 0.25rem;
  cursor: pointer;
}
.presenter-settings-item:hover {
  background: var(--accent, #eee);
}
`;

const EXPORT_SAFARI_COLOR_FALLBACKS = `
@supports (font: -apple-system-body) {
  .slide-frame-bar .slide-locate-btn,
  .app-header-bar .slide-locate-btn {
    border: 1px solid rgba(255, 255, 255, 0.35);
    background-color: rgba(255, 255, 255, 0.12);
    color: inherit;
  }
  .slide-frame-bar .slide-locate-btn:hover,
  .app-header-bar .slide-locate-btn:hover {
    background-color: rgba(255, 255, 255, 0.22);
    color: inherit;
  }
  .presenter-settings-item:hover {
    background-color: rgba(128, 128, 128, 0.15);
  }
}
`;

const ICON_CHEVRON_LEFT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const ICON_CHEVRON_RIGHT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
const ICON_SETTINGS =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_X =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function buildPresenterScript(initialLanguage: Language, initialTheme: Theme): string {
  const ui = JSON.stringify(presenterUiCopy);

  return `
(function () {
  var UI = ${ui};
  var slides = Array.prototype.slice.call(document.querySelectorAll(".export-slide"));
  var index = 0;
  var language = ${JSON.stringify(initialLanguage)};
  var theme = ${JSON.stringify(initialTheme)};
  var counter = document.getElementById("counter");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var settingsMenu = document.getElementById("settings-menu");
  var settingsToggle = document.getElementById("settings-toggle");
  var themeItem = document.getElementById("theme-item");
  var langItem = document.getElementById("lang-item");
  var exitBtn = document.getElementById("exit");

  try {
    var storedLanguage = localStorage.getItem("language");
    if (storedLanguage === "en" || storedLanguage === "zh") {
      language = storedLanguage;
    }
    var storedTheme = localStorage.getItem("theme");
    if (storedTheme === "day" || storedTheme === "night") {
      theme = storedTheme;
    }
  } catch (e) {}

  function labels() {
    return UI[language] || UI.en;
  }

  function themeLabel() {
    var t = labels();
    return theme === "night" ? t.themeNight : t.themeDay;
  }

  function languageToggleLabel() {
    return language === "en"
      ? "Language: " + UI.en.languageEn
      : "语言: " + UI.zh.languageZh;
  }

  function applyTheme() {
    document.documentElement.classList.toggle("night", theme === "night");
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
  }

  function closeSettingsMenu() {
    if (settingsMenu) settingsMenu.classList.remove("is-open");
  }

  function updateChrome() {
    var t = labels();
    var prevLabel = document.getElementById("prev-label");
    var nextLabel = document.getElementById("next-label");
    if (prevLabel) prevLabel.textContent = t.previous;
    if (nextLabel) nextLabel.textContent = t.next;
    if (themeItem) themeItem.textContent = t.themeLabel + ": " + themeLabel();
    if (langItem) langItem.textContent = languageToggleLabel();
    var settingsLabel = document.getElementById("settings-label");
    if (settingsLabel) settingsLabel.textContent = t.settings;
    var hint = document.getElementById("help-hint");
    if (hint) hint.textContent = t.hint;
    if (settingsToggle) {
      settingsToggle.setAttribute("aria-label", t.settings);
      settingsToggle.setAttribute("title", t.settings);
    }
    if (exitBtn) {
      exitBtn.setAttribute("aria-label", t.exit);
      exitBtn.setAttribute("title", t.exit);
    }
  }

  function viewportSize() {
    var vv = window.visualViewport;
    return {
      width: (vv && vv.width) || window.innerWidth,
      height: (vv && vv.height) || window.innerHeight
    };
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function requestFullscreen() {
    var el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(function () {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  }

  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }

  function fitActiveSlide() {
    var active = slides[index];
    if (!active) return;
    var page = active.querySelector(".export-slide-page");
    if (!page) return;
    var size = viewportSize();
    var scale = Math.min(
      (size.width - 32) / ${SLIDE_WIDTH},
      (size.height - 120) / ${SLIDE_HEIGHT},
      1
    );
    var transform = "scale(" + scale + ")";
    page.style.transform = transform;
    page.style.webkitTransform = transform;
  }

  function render() {
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", i === index);
    });
    if (counter) {
      counter.textContent = (index + 1) + " / " + slides.length;
    }
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= slides.length - 1;
    fitActiveSlide();
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

  function toggleTheme() {
    theme = theme === "night" ? "day" : "night";
    applyTheme();
    updateChrome();
  }

  function toggleLanguage() {
    language = language === "en" ? "zh" : "en";
    try {
      localStorage.setItem("language", language);
    } catch (e) {}
    updateChrome();
  }

  function exitPresenter() {
    if (fullscreenElement()) {
      exitFullscreen();
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      exitPresenter();
    } else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
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
    } else if (e.key === "f" || e.key === "F") {
      if (!fullscreenElement()) {
        requestFullscreen();
      } else {
        exitFullscreen();
      }
    }
  });

  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);
  if (settingsToggle) {
    settingsToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (settingsMenu) settingsMenu.classList.toggle("is-open");
    });
  }
  if (settingsMenu) {
    settingsMenu.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }
  document.addEventListener("click", closeSettingsMenu);
  if (themeItem) {
    themeItem.addEventListener("click", function () {
      toggleTheme();
      closeSettingsMenu();
    });
  }
  if (langItem) {
    langItem.addEventListener("click", function () {
      toggleLanguage();
      closeSettingsMenu();
    });
  }
  if (exitBtn) exitBtn.addEventListener("click", exitPresenter);
  window.addEventListener("resize", fitActiveSlide);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fitActiveSlide);
  }

  applyTheme();
  updateChrome();
  render();
})();
`;
}

async function renderSlidesForExport(
  markdown: string,
  theme: SlideThemeId,
  colorTheme: Theme,
  onSlide: (element: HTMLElement, index: number) => Promise<void>,
): Promise<void> {
  const slides = splitSlides(markdown);
  const existing = document.getElementById(EXPORT_MOUNT_ID);
  existing?.remove();

  const mount = document.createElement("div");
  mount.id = EXPORT_MOUNT_ID;
  mount.className = colorTheme === "night" ? "night" : "";
  // Keep off-screen but visible — html2canvas cannot rasterize visibility:hidden trees.
  mount.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1280px;height:720px;pointer-events:none;opacity:1;overflow:visible;";
  document.body.appendChild(mount);

  const root = createRoot(mount);

  try {
    for (let i = 0; i < slides.length; i++) {
      root.render(
        createElement(ExportSlidePage, {
          markdown: slides[i] ?? "",
          theme,
        }),
      );
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

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadSlidesPdf(
  markdown: string,
  theme: SlideThemeId,
  colorTheme: Theme,
): Promise<void> {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const html2canvas =
    html2canvasModule.default ??
    html2canvasModule.html2canvas ??
    html2canvasModule;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [SLIDE_WIDTH, SLIDE_HEIGHT],
    hotfixes: ["px_scaling"],
  });

  await renderSlidesForExport(markdown, theme, colorTheme, async (slideEl, index) => {
    const captureTarget = prepareSlideForCapture(slideEl);
    const backgroundColor = getCaptureBackgroundColor(captureTarget);

    const canvas = await html2canvas(captureTarget, {
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      scale: 2,
      useCORS: true,
      backgroundColor,
      logging: false,
    });

    if (index > 0) {
      pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT], "landscape");
    }

    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      SLIDE_WIDTH,
      SLIDE_HEIGHT,
    );
  });

  pdf.save("quick-slides.pdf");
}

function buildHtmlDocument(
  slideFragments: string[],
  colorTheme: Theme,
  slideThemeId: SlideThemeId,
  language: Language,
): string {
  const slidesHtml = slideFragments
    .map(
      (fragment, index) =>
        `<div class="export-slide${index === 0 ? " is-active" : ""}" data-index="${index}">${fragment}</div>`,
    )
    .join("\n");

  const nightClass = colorTheme === "night" ? " night" : "";
  const slideThemeClass = getSlideThemeAttributes(slideThemeId).className;
  const t = presenterUiCopy[language];
  const themeLabel = colorTheme === "night" ? t.themeNight : t.themeDay;
  const languageToggleLabel =
    language === "en" ? `Language: ${t.languageEn}` : `语言: ${t.languageZh}`;
  const presenterScript = buildPresenterScript(language, colorTheme);

  return `<!DOCTYPE html>
<html lang="${language}" class="${nightClass.trim()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quick Slides</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
${collectEmbeddedStyles()}
${PRESENTER_STYLES}
${EXPORT_SAFARI_COLOR_FALLBACKS}
  </style>
</head>
<body>
  <div id="presenter" class="export-presenter slide-presenter ${slideThemeClass}">
    <div id="stage" class="export-presenter-stage">
${slidesHtml}
    </div>
    <div class="slide-frame-bar presenter-bar">
      <span id="counter" class="slide-locate-btn presenter-counter">1 / ${slideFragments.length}</span>
      <div class="presenter-nav">
        <button type="button" id="prev" class="slide-locate-btn presenter-btn presenter-btn-nav" disabled>
          ${ICON_CHEVRON_LEFT}
          <span id="prev-label">${t.previous}</span>
        </button>
        <button type="button" id="next" class="slide-locate-btn presenter-btn presenter-btn-nav"${slideFragments.length <= 1 ? " disabled" : ""}>
          <span id="next-label">${t.next}</span>
          ${ICON_CHEVRON_RIGHT}
        </button>
      </div>
      <div class="presenter-actions">
        <button type="button" class="slide-locate-btn presenter-btn presenter-btn-icon presenter-help" aria-label="${t.help}">
          <span>?</span>
          <span id="help-hint" class="presenter-help-tooltip">${t.hint}</span>
        </button>
        <div class="presenter-settings">
          <button type="button" id="settings-toggle" class="slide-locate-btn presenter-btn presenter-btn-icon" aria-label="${t.settings}" title="${t.settings}">
            ${ICON_SETTINGS}
          </button>
          <div id="settings-menu" class="presenter-settings-menu">
            <div id="settings-label" class="presenter-settings-label">${t.settings}</div>
            <button type="button" id="theme-item" class="presenter-settings-item">${t.themeLabel}: ${themeLabel}</button>
            <button type="button" id="lang-item" class="presenter-settings-item">${languageToggleLabel}</button>
          </div>
        </div>
        <button type="button" id="exit" class="slide-locate-btn presenter-btn presenter-btn-icon" aria-label="${t.exit}" title="${t.exit}">
          ${ICON_X}
        </button>
      </div>
    </div>
  </div>
  <script>${presenterScript}<\/script>
</body>
</html>`;
}

export async function downloadSlidesHtml(
  markdown: string,
  theme: SlideThemeId,
  colorTheme: Theme,
): Promise<void> {
  const slideFragments: string[] = [];

  await renderSlidesForExport(markdown, theme, colorTheme, async (slideEl) => {
    slideFragments.push(slideEl.outerHTML);
  });

  const html = buildHtmlDocument(slideFragments, colorTheme, theme, getLanguage());
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "quick-slides.html");
}
