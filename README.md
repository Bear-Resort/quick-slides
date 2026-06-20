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

## Tech stack

React, Vite, TypeScript, Tailwind CSS, KaTeX, html2canvas-pro, jsPDF
