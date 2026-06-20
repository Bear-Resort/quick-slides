/** Copy-ready AI instructions for generating Quick Slides markdown decks. */
export const QUICK_SLIDES_AI_INSTRUCTIONS = `# Quick Slides — AI writing instructions

Use these instructions when generating markdown slide decks for Quick Slides (or any markdown-to-slides tool that splits on \`---\`).

## How to use

Paste this entire document into:

- A chat with **Claude**, **ChatGPT**, **Codex**, **Gemini**, or any AI assistant
- **Custom instructions** or **project rules** (Cursor, Claude Code, Codex, VS Code, etc.)
- A project file such as \`SKILL.md\`, \`AGENTS.md\`, \`instructions.md\`, or \`.cursorrules\`
- A saved snippet you reuse whenever you need a new deck

Apply whenever the user asks for presentations, slide decks, talks, or markdown formatted for Quick Slides.

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

## Math (LaTeX)

- Inline: \`$E = mc^2$\`
- Display (centered block): \`$$\\\\sin 2x = 2\\\\sin x\\\\cos x$$\`

Put \`$$...$$\` on its own lines for display math.

## Supported markdown

- Headings \`#\` through \`###\` (see layout rules above)
- **Bold**, *italic*, lists, blockquotes, tables, fenced code blocks
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

![Diagram](https://example.com/diagram.png)
\`\`\`

## Rules

1. Always separate slides with \`---\` on its own line.
2. Start the deck with a \`#\` title slide; use \`##\` for subtitle text.
3. Use \`###\` for every content slide section title — not \`##\`.
4. Keep slides concise; split long content across multiple slides.
5. Put at most one image per slide; keep explanatory text on the left.
6. Use display math (\`$$\`) for important equations; inline math (\`$\`) for short expressions.
7. Output only the markdown deck unless the user asks for commentary.
`;

/** @deprecated Use QUICK_SLIDES_AI_INSTRUCTIONS */
export const QUICK_SLIDES_SKILL = QUICK_SLIDES_AI_INSTRUCTIONS;
