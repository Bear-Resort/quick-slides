import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { rehypeKatexStripMathml } from "@/lib/rehypeKatexStripMathml";

/**
 * Shared markdown → HTML pipeline.
 * Highlight fenced code (```lang) before KaTeX; strip MathML after KaTeX.
 */
export const markdownRehypePlugins = [
  rehypeHighlight,
  rehypeKatex,
  rehypeKatexStripMathml,
] as const;
