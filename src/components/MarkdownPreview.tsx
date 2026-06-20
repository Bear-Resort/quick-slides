import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizeDisplayMath } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type SlideSize = "preview" | "present";

type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
  variant?: "document" | "slide";
  slideSize?: SlideSize;
};

function createSlideComponents(size: SlideSize) {
  const isPreview = size === "preview";

  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1
        className={cn(
          "mb-3 text-center font-black leading-tight",
          isPreview ? "text-lg sm:text-xl" : "text-4xl sm:text-5xl lg:text-6xl",
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2
        className={cn(
          "mb-2 font-bold",
          isPreview ? "text-base sm:text-lg" : "text-2xl sm:text-3xl lg:text-4xl",
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3
        className={cn(
          "mb-2 font-bold",
          isPreview ? "text-sm sm:text-base" : "text-xl sm:text-2xl lg:text-3xl",
        )}
      >
        {children}
      </h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p
        className={cn(
          "leading-relaxed",
          isPreview ? "text-xs sm:text-sm" : "text-lg sm:text-xl lg:text-2xl",
        )}
      >
        {children}
      </p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul
        className={cn(
          "list-disc space-y-1 pl-5",
          isPreview ? "text-xs sm:text-sm" : "text-lg sm:text-xl lg:text-2xl",
          !isPreview && "space-y-2 pl-8",
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol
        className={cn(
          "list-decimal space-y-1 pl-5",
          isPreview ? "text-xs sm:text-sm" : "text-lg sm:text-xl lg:text-2xl",
          !isPreview && "space-y-2 pl-8",
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote
        className={cn(
          "border-l-4 border-gray-300 italic text-muted-foreground dark:border-gray-700",
          isPreview
            ? "pl-3 text-xs sm:text-sm"
            : "pl-5 text-lg sm:text-xl lg:text-2xl",
        )}
      >
        {children}
      </blockquote>
    ),
    code: ({
      className: codeClassName,
      children,
    }: {
      className?: string;
      children?: ReactNode;
    }) => {
      const isBlock = codeClassName?.includes("language-");
      if (isBlock) {
        return (
          <code
            className={cn(
              "block overflow-x-auto rounded-lg bg-secondary p-3 font-mono",
              isPreview ? "text-[10px]" : "text-sm sm:text-base",
            )}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          className={cn(
            "rounded bg-secondary px-1 py-0.5 font-mono",
            isPreview ? "text-[10px]" : "text-base",
          )}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }: { children?: ReactNode }) => (
      <pre
        className={cn(
          "overflow-x-auto rounded-lg bg-secondary p-3 font-mono",
          isPreview ? "text-[10px]" : "text-sm sm:text-base",
        )}
      >
        {children}
      </pre>
    ),
    hr: () => null,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse text-left",
            isPreview ? "text-[10px] sm:text-xs" : "text-base sm:text-lg",
          )}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th
        className={cn(
          "border border-gray-300 font-semibold dark:border-gray-700",
          isPreview ? "px-2 py-1" : "px-3 py-2",
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td
        className={cn(
          "border border-gray-300 dark:border-gray-700",
          isPreview ? "px-2 py-1" : "px-3 py-2",
        )}
      >
        {children}
      </td>
    ),
  };
}

const documentComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-2xl font-black">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-xl font-bold">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-lg font-bold">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 italic text-muted-foreground dark:border-gray-700">
      {children}
    </blockquote>
  ),
  code: ({
    className: codeClassName,
    children,
  }: {
    className?: string;
    children?: ReactNode;
  }) => {
    const isBlock = codeClassName?.includes("language-");
    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="overflow-x-auto rounded-lg bg-secondary p-3 font-mono text-xs">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-gray-300 dark:border-gray-700" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-gray-300 px-3 py-2 font-semibold dark:border-gray-700">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-gray-300 px-3 py-2 dark:border-gray-700">
      {children}
    </td>
  ),
};

export function MarkdownPreview({
  markdown,
  className,
  variant = "document",
  slideSize = "preview",
}: MarkdownPreviewProps) {
  const normalized = normalizeDisplayMath(markdown);
  const isSlide = variant === "slide";

  return (
    <div
      className={cn(
        "markdown-preview leading-relaxed [&_a]:text-blue-600 dark:[&_a]:text-blue-400",
        isSlide ? "slide-content space-y-3" : "space-y-4 text-sm",
        isSlide && slideSize === "present" && "space-y-5",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={
          isSlide ? createSlideComponents(slideSize) : documentComponents
        }
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
