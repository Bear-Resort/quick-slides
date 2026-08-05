import type { Element, ElementContent, Root, Text } from "hast";

function classNames(node: Element): string[] {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function walk(node: ElementContent | Root, visit: (element: Element) => void): void {
  if (node.type === "element") {
    visit(node);
    for (const child of node.children) walk(child, visit);
    return;
  }
  if (node.type === "root") {
    for (const child of node.children) walk(child, visit);
  }
}

function collectText(node: ElementContent | Root): string {
  if (node.type === "text") return (node as Text).value;
  if (node.type === "element" || node.type === "root") {
    return node.children.map((child) => collectText(child)).join("");
  }
  return "";
}

function findTexAnnotation(node: ElementContent): string | null {
  if (node.type !== "element") return null;

  if (node.tagName === "annotation") {
    const encoding = node.properties?.encoding;
    const isTex =
      encoding === "application/x-tex" ||
      (Array.isArray(encoding) &&
        encoding.map(String).includes("application/x-tex"));
    if (isTex) {
      const tex = collectText(node).trim();
      return tex || null;
    }
  }

  for (const child of node.children) {
    const tex = findTexAnnotation(child);
    if (tex) return tex;
  }
  return null;
}

/**
 * After rehype-katex: copy TeX into `data-tex` and drop MathML from the tree.
 * Prefer configuring rehype-katex with `output: "html"` so MathML is never emitted.
 */
export function rehypeKatexStripMathml() {
  return (tree: Root) => {
    walk(tree, (node) => {
      const classes = classNames(node);
      if (!classes.includes("katex") || classes.includes("katex-mathml")) return;

      let tex: string | null = null;
      const kept: ElementContent[] = [];

      for (const child of node.children) {
        if (
          child.type === "element" &&
          classNames(child).includes("katex-mathml")
        ) {
          tex = findTexAnnotation(child) ?? tex;
          continue;
        }
        kept.push(child);
      }

      if (tex) {
        node.properties = {
          ...node.properties,
          dataTex: tex,
        };
      }
      node.children = kept;
    });
  };
}
