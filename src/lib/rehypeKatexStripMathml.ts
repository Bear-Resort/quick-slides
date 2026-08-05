/** Minimal hast shapes — avoids a direct `hast` / `@types/hast` dependency. */
type HastText = {
  type: "text";
  value: string;
};

type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastContent[];
};

type HastRoot = {
  type: "root";
  children: HastContent[];
};

type HastContent = HastElement | HastText | { type: string; children?: HastContent[] };

function classNames(node: HastElement): string[] {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

function walk(node: HastContent | HastRoot, visit: (element: HastElement) => void): void {
  if (node.type === "element") {
    const element = node as HastElement;
    visit(element);
    for (const child of element.children) walk(child, visit);
    return;
  }
  if (node.type === "root") {
    for (const child of (node as HastRoot).children) walk(child, visit);
  }
}

function collectText(node: HastContent | HastRoot): string {
  if (node.type === "text") return (node as HastText).value;
  if (node.type === "element" || node.type === "root") {
    const children =
      node.type === "element"
        ? (node as HastElement).children
        : (node as HastRoot).children;
    return children.map((child) => collectText(child)).join("");
  }
  return "";
}

function findTexAnnotation(node: HastContent): string | null {
  if (node.type !== "element") return null;
  const element = node as HastElement;

  if (element.tagName === "annotation") {
    const encoding = element.properties?.encoding;
    const isTex =
      encoding === "application/x-tex" ||
      (Array.isArray(encoding) &&
        encoding.map(String).includes("application/x-tex"));
    if (isTex) {
      const tex = collectText(element).trim();
      return tex || null;
    }
  }

  for (const child of element.children) {
    const tex = findTexAnnotation(child);
    if (tex) return tex;
  }
  return null;
}

/**
 * After rehype-katex: copy TeX into `data-tex` and drop MathML from the tree.
 * Safari's native MathML layout fights KaTeX HTML (tiny/huge equations).
 */
export function rehypeKatexStripMathml() {
  return (tree: HastRoot) => {
    walk(tree, (node) => {
      const classes = classNames(node);
      if (!classes.includes("katex") || classes.includes("katex-mathml")) return;

      let tex: string | null = null;
      const kept: HastContent[] = [];

      for (const child of node.children) {
        if (
          child.type === "element" &&
          classNames(child as HastElement).includes("katex-mathml")
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
