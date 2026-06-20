import { IMAGE_PLACEHOLDER_MARKDOWN } from "@/lib/editorPlaceholders";

export const SAMPLE_MARKDOWN = `# Quick Slides

## Presentations from markdown — separate slides with \`---\`

---

### Features

- **Bold** and *italic* text
- Lists and [links](https://bear-resort.github.io/)
- Inline math: $E = mc^2$

---

### Math

Double-angle identity:

$$\\sin 2x = 2\\sin x\\cos x$$

---

### With image

Content stays on the left.

![Bear Resort](https://bear-resort.github.io/logos/default-bear.gif)

---

### Placeholder

No URL yet — placeholder on the right.

${IMAGE_PLACEHOLDER_MARKDOWN}
`;

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Remove HTML comments from a single line (outside code fences). */
export function stripInlineHtmlComments(text: string): string {
  return text.replace(HTML_COMMENT_PATTERN, "");
}

/** Remove HTML comments outside fenced code blocks (hidden in slide preview). */
export function stripHtmlComments(markdown: string): string {
  const parts = markdown.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(HTML_COMMENT_PATTERN, "");
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n");
}

/** Prepare markdown for slide rendering. */
export function prepareSlideMarkdown(markdown: string): string {
  return stripHtmlComments(markdown);
}

/** Put $$...$$ on its own lines so remark-math treats them as display math. */
export function normalizeDisplayMath(markdown: string): string {
  const parts = markdown.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;

      return part
        .replace(
          /^(\s*(?:[-*+]|\d+\.)\s+)\$\$([\s\S]*?)\$\$/gm,
          (_, prefix, expression) =>
            `${prefix}\n\n$$\n${expression.trim()}\n$$`,
        )
        .replace(/\$\$([^\n$]+)\$\$/g, (_, expression) => {
          return `\n$$\n${expression.trim()}\n$$`;
        });
    })
    .join("");
}
