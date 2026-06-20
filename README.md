# Quick Slides

Write presentations in Markdown and preview them instantly. Quick Slides is a lightweight, browser-based slide editor with live preview, fullscreen presenting, and PDF/HTML export.

**Live site:** [https://bear-resort.github.io/quick-slides/](https://bear-resort.github.io/quick-slides/)

## What it does

- **Split-pane editor** — Markdown on the left, slides on the right, updating as you type
- **Slide decks from Markdown** — Separate slides with a line containing only `---`
- **Layout rules** — `#` for title slides, `##` for subtitle slides, `###` and below for content slides with a page heading
- **Rich content** — GFM tables, lists, links, blockquotes, code blocks, and images (including placeholders)
- **Math** — Inline (`$…$`) and display (`$$…$$`) equations via KaTeX
- **Themes** — Regular, gray, and color-tinted themes (blue, red, green, purple), plus sticker themes:
  - **Bear Academy (小熊學園)** — yellow tint with corner stickers
  - **The Beauties (美少女们)** — pink tint with corner stickers
- **Present mode** — Fullscreen slideshow with keyboard navigation
- **Export** — Download as PDF or a standalone HTML presentation
- **English / 中文** — UI language follows your browser or saved preference

## Quick start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Use **Load sample** in the header to try example slides.

Build for production:

```bash
pnpm build
pnpm preview
```

## Writing slides

```markdown
# Title slide

## Subtitle slide

---

### Content slide

- Bullet one
- Bullet two

Inline math: $E = mc^2$

---

### Another slide

$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$
```

Put `---` on its own line between slides. Optional images use standard Markdown syntax: `![alt text](url)`.

## Deployment

The app is deployed to **GitHub Pages** on every push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

| | |
|---|---|
| **URL** | [https://bear-resort.github.io/quick-slides/](https://bear-resort.github.io/quick-slides/) |
| **Repository** | [github.com/Bear-Resort/quick-slides](https://github.com/Bear-Resort/quick-slides) |

The production build sets `GITHUB_PAGES=true` so assets are served under the `/quick-slides/` base path.

## PDF export (how it works)

PDF export runs **entirely in your browser** on the live site. GitHub Pages only hosts the static app; it does not generate PDFs on the server.

When you click **Download → PDF**, the app:

1. Renders each slide off-screen in the browser (same React components as the preview)
2. Loads **MathJax** from jsDelivr CDN to rasterize equations for capture
3. Screenshots each slide with **html2canvas-pro** and assembles a **jsPDF** file

**What is bundled at build time (not read from your disk at export time):**

- Theme sticker images from `themes/bear-academy/` and `themes/the-beauties/` → copied into `dist/assets/` by Vite
- KaTeX fonts and app CSS/JS

**What is fetched at export time over the network:**

- MathJax (`cdn.jsdelivr.net`) — required for reliable equation rendering in PDFs
- Any **external images** in your Markdown (must allow cross-origin access, or they may be missing from the PDF)

There are **no local filesystem paths** involved on the deployed site. If you see errors mentioning `/themes/...` or missing files, that usually means an old build or a URL that was not bundled — redeploy from `main` after a fresh `pnpm build`.

**Tips if PDF export fails on the live site:**

- Use a normal browser tab (not an embedded preview with blocked network access)
- Check the browser console for MathJax or CORS errors
- Prefer HTTPS image URLs that allow cross-origin embedding
- Sticker themes use large PNGs; export waits for them to load, but a slow connection may take a few seconds

## Tech stack

React, Vite, TypeScript, Tailwind CSS, KaTeX, html2canvas-pro, jsPDF
