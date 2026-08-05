import rehypeKatex from "rehype-katex";
import { rehypeKatexStripMathml } from "@/lib/rehypeKatexStripMathml";

/**
 * Shared markdown → KaTeX pipeline.
 * Strip MathML after render (Safari scales native MathML to a fixed slot).
 * TeX is kept on `data-tex` for PDF export.
 */
export const markdownRehypePlugins = [
  rehypeKatex,
  rehypeKatexStripMathml,
] as const;
