/** Copy-ready AI instructions for generating Quick Slides markdown decks. */
export const QUICK_SLIDES_AI_INSTRUCTIONS = `# Quick Slides — AI writing instructions

Use these instructions when generating markdown slide decks for Quick Slides (or any markdown-to-slides tool that splits on \`---\`).

Quick Slides is a **Bear Resort** app for quick, systematic slides using markdown and an agent-friendly repository layout.

## How to use

Paste this entire document into:

- A chat with **Claude**, **ChatGPT**, **Codex**, **Gemini**, or any AI assistant
- **Custom instructions** or **project rules** (Cursor, Claude Code, Codex, VS Code, etc.)
- A project file such as \`SKILL.md\`, \`AGENTS.md\`, \`instructions.md\`, or \`.cursorrules\`
- A saved snippet you reuse whenever you need a new deck

Apply whenever the user asks for presentations, slide decks, talks, or markdown formatted for Quick Slides — including setting up a **GitHub repository** for a deck.

---

## Repository layout (GitHub / local library)

Each presentation is a folder (a GitHub repo root, or a subfolder under a shared library repo) with this structure:

\`\`\`
my-talk/
  deck.md              # default slide markdown (entry file)
  quick-slides.json    # title, themes, entry file, timestamps
  images/              # optional images referenced as images/<file>
  talks/intro.md       # optional extra .md decks in the same repo
\`\`\`

When creating or scaffolding a GitHub repository for Quick Slides:

1. Create a repo (public or private) with at least \`deck.md\` and \`quick-slides.json\`.
2. Optionally add an empty \`images/\` directory (or create it when the first image is added).
3. Keep paths relative to the deck root — never absolute paths in markdown or JSON.
4. Link the local presentation to that repo in Quick Slides (Git panel) so push/pull syncs these files via the GitHub Contents API.
5. Prefer one logical deck per \`.md\` file; put multiple decks in one repo only when they share assets or a project.

### \`quick-slides.json\` schema

Always write valid JSON. Minimal example:

\`\`\`json
{
  "version": 1,
  "title": "My Talk",
  "fileStyles": {
    "deck.md": { "theme": "regular", "colorMode": "light" }
  },
  "entryFile": "deck.md",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
\`\`\`

Field rules:

| Field | Required | Meaning |
|-------|----------|---------|
| \`version\` | yes | Format version — use \`1\` |
| \`title\` | yes | Presentation title (export filenames, library list) |
| \`entryFile\` | yes | Markdown path used for preview/export (e.g. \`deck.md\`) |
| \`fileStyles\` | yes | Per-\`.md\`-file themes, keyed by path relative to repo root |
| \`createdAt\` | yes | ISO-8601 creation time (push commits record updates) |

**Theme ids:** \`regular\`, \`gray\`, \`blue\`, \`red\`, \`green\`, \`purple\`, \`bear-academy\`, \`the-beauties\`

**Color modes:** \`light\` or \`dark\`

**Per-file themes:** each \`.md\` file has one theme for all of its slides. Different markdown files in the same repo may use different themes via \`fileStyles\`:

\`\`\`json
"fileStyles": {
  "deck.md": { "theme": "regular", "colorMode": "light" },
  "talks/intro.md": { "theme": "bear-academy", "colorMode": "dark" }
}
\`\`\`

When you add a new \`.md\` file, add a matching \`fileStyles\` entry (or Quick Slides will fall back to the entry file’s style). When you rename a \`.md\` file, rename the key in \`fileStyles\` and update \`entryFile\` if needed.

Images in markdown should use relative paths under \`images/\`, for example \`![Alt](images/diagram.png)\`.

---

## Format overview

Quick Slides turns markdown into presentation slides. Slides are separated by \`---\` on its own line.

| Markdown | Role | Layout |
|----------|------|--------|
| \`#\` | Main title | Title slide — large centered heading, content block vertically centered |
| \`##\` | Subtitle | Centered, smaller text below \`#\` on title slides, or a subtitle-only slide |
| \`###\` | Page title | Content slide — fixed title at top, body vertically centered below |

### Title slide (\`#\`)

\`\`\`markdown
# Project Name

## One-line subtitle or tagline
\`\`\`

- Only \`#\` and \`##\` are centered horizontally.
- Paragraphs, lists, and other body text are left-aligned.
- The whole block is vertically centered on the slide.

### Content slide (\`###\`)

\`\`\`markdown
### Section Title

- Bullet one
- Bullet two

Body paragraph with **bold**, *italic*, and [links](https://example.com).
\`\`\`

- \`###\` becomes the fixed page title at the top (same position on every content slide).
- Body content is left-aligned and vertically centered in the remaining space.

## Slide separators

Use \`---\` on its own line between slides. Separators inside fenced code blocks are ignored.

\`\`\`markdown
# Slide 1

---

### Slide 2

More content here.
\`\`\`

## Images

Place one image per slide with standard markdown syntax. The image appears on the right half; text stays on the left.

\`\`\`markdown
### Example

Explanation on the left.

![Alt text](https://example.com/image.png)
\`\`\`

- Empty \`()\` shows a placeholder while loading or if the URL is missing.
- Only the first image on a slide is used.
- In a Quick Slides repo, prefer \`images/<filename>\` so assets sync with GitHub.

## Math (LaTeX)

- Inline: \`$E = mc^2$\`
- Display (centered block): \`$$\\\\sin 2x = 2\\\\sin x\\\\cos x$$\`

Put \`$$...$$\` on its own lines for display math.

## Supported markdown

- Headings \`#\` through \`###\` (see layout rules above)
- **Bold**, *italic*, lists, blockquotes, tables, fenced code blocks (\`\`\`lang for syntax highlighting)
- GFM tables and strikethrough

## Full deck template

\`\`\`markdown
# Deck Title

## Subtitle or date

---

### Agenda

- Topic one
- Topic two

---

### Key idea

Main point in a short paragraph.

$$\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}$$

---

### Diagram

Brief caption on the left.

![Diagram](images/diagram.png)
\`\`\`

## Rules

1. Always separate slides with \`---\` on its own line.
2. Start the deck with a \`#\` title slide; use \`##\` for subtitle text.
3. Use \`###\` for every content slide section title — not \`##\`.
4. Keep slides concise; split long content across multiple slides.
5. Put at most one image per slide; keep explanatory text on the left.
6. Use display math (\`$$\`) for important equations; inline math (\`$\`) for short expressions.
7. When scaffolding a GitHub (or library) deck, always include \`quick-slides.json\` with \`title\`, \`entryFile\`, and \`fileStyles\` for every \`.md\` deck file.
8. One theme per \`.md\` file (via \`fileStyles\`); do not invent per-slide theme fields.
9. Output only the markdown deck (and \`quick-slides.json\` when asked to set up a repo) unless the user asks for commentary.
`;

/** @deprecated Use QUICK_SLIDES_AI_INSTRUCTIONS */
export const QUICK_SLIDES_SKILL = QUICK_SLIDES_AI_INSTRUCTIONS;
