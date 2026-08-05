# Quick Slides

Write presentations in Markdown and preview them instantly. Quick Slides is a lightweight, browser-based slide editor with live preview, fullscreen presenting, and PDF/HTML export.

**Live site:** [https://bear-resort.github.io/quick-slides/](https://bear-resort.github.io/quick-slides/)

## What it does

- **Split-pane editor** — Markdown on the left, slides on the right, updating as you type
- **Slide decks from Markdown** — Separate slides with a line containing only `---`
- **Layout rules** — `#` for title slides, `##` for subtitle slides, `###` and below for content slides with a page heading
- **Rich content** — GFM tables, lists, links, blockquotes, code blocks, and images (including placeholders)
- **Math** — Inline (`$…$`) and display (`$$…$$`) equations via KaTeX
- **Themes** — Regular, gray, and color-tinted themes (blue, red, green, purple), plus sticker themes with configurable layouts (see [Theme setup](#theme-setup)):
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

Open [http://localhost:5173](http://localhost:5173). The **library home** lists saved presentations (after you choose a folder). Use **Continue without saving** for a one-off session, or **Load sample** in the editor header.

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

## Local library (Chrome, Edge, Safari desktop)

Quick Slides can save presentations locally using the browser [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

1. On the library home, click **Use ~/qs-slides** (Chrome/Edge) or open the app (Safari/Firefox — library auto-initializes).
   - **Chrome / Edge:** creates `~/qs-slides` in browser storage, or **Choose another folder** for a real disk location.
   - **Safari / Firefox:** presentations save in browser-managed local storage automatically (OPFS). No disk folder picker.
   - On return visits, Quick Slides reconnects and scans that folder automatically.
2. Click **New presentation** — each deck is stored as its own subfolder.
3. Edit in the browser; changes **autosave** (~800ms after you stop typing).
4. Uploaded images are written to that deck's `images/` folder (not ephemeral browser storage).

### On-disk layout

```
YourLibraryFolder/
  my-talk-a1b2/
    deck.md              # slide markdown
    quick-slides.json    # title, theme, created/updated timestamps
    images/
      uuid.png           # images referenced from deck.md
```

- **Open** a deck from the library list (sorted by last opened).
- **Delete** removes the deck's subfolder from your library folder.
- **Rename** the title in the editor; the folder name stays stable.
- **Export** (PDF/HTML) uses the presentation title as the download filename.

Safari Private Browsing disables origin storage — use a normal window or **Continue without saving**. Firefox does not yet support the default library; use **Continue without saving** there.

## GitHub sync (local development)

In the editor toolbar, **Files** browses your library, **GitHub** signs in via Device Flow, and **Git** pushes/pulls the current presentation to a linked GitHub repository (Contents API).

1. Create a GitHub OAuth App at [GitHub Developer Settings](https://github.com/settings/developers).
2. Enable **Device Flow** on the app.
3. Copy `.env.example` to `.env.local` and set `VITE_GITHUB_CLIENT_ID`.
4. Run `pnpm dev` — Device Flow calls are proxied through Vite (`/github-oauth` → `github.com`) because browsers block CORS on GitHub’s login endpoints.

Production static hosts (e.g. GitHub Pages) need an equivalent reverse proxy for `/github-oauth` for sign-in to work; the GitHub REST API itself is called directly from the browser with the stored token.

## Theme setup

Sticker themes (Bear Academy, The Beauties) are configured in setup files under `src/lib/themes/`:

| File | Theme |
|------|-------|
| [`bear-academy.setup.ts`](src/lib/themes/bear-academy.setup.ts) | Bear Academy |
| [`the-beauties.setup.ts`](src/lib/themes/the-beauties.setup.ts) | The Beauties |

Each sticker entry specifies:

- **`file`** — filename in `themes/<theme-id>/` (for reference)
- **`maxHeight`** — max rendered height in px on the 1280×720 slide (adjust per image)
- **`layouts`** — which slide types use this sticker (`title`, `subtitle`, `content`)

Stickers are placed in the **bottom-left or bottom-right corner** (alternating by slide index, switching if overlapping text). They rotate by slide index among entries that match the current layout.

## Deployment

The app is deployed to **GitHub Pages** on every push to `main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

| | |
|---|---|
| **URL** | [https://bear-resort.github.io/quick-slides/](https://bear-resort.github.io/quick-slides/) |
| **Repository** | [github.com/Bear-Resort/quick-slides](https://github.com/Bear-Resort/quick-slides) |

The production build sets `GITHUB_PAGES=true` so assets are served under the `/quick-slides/` base path.

## PDF export (how it works)

**PDF (selectable text)** posts print-ready HTML to Convex `/export-pdf` → Browserless Chrome prints a clean 1280×720 PDF (selectable text/math, no browser print headers). Requires GitHub sign-in and a weekly quota (`free` 3 / `premium` 15 / `pro` 40 / `admin` unlimited; global monthly safety cap 400 for non-admin). Image PDF and HTML stay client-side and unlimited.

```bash
npx convex env set BROWSERLESS_API_TOKEN <token>
```

Also set `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` in `.env.local`. Tuned for Browserless **free tier** (short session, small payload, ≤25 slides / ~1.4MB HTML); larger decks fall back to the image path. Admin: `/admin/exports` (GitHub `James-Guo-03` only).

**PDF (image)** uses **html2canvas-pro** + **jsPDF** (silent download; not selectable).

## Tech stack

React, Vite, TypeScript, Tailwind CSS, KaTeX, html2canvas-pro, jsPDF
