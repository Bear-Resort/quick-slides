import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CodeProps = {
  className?: string;
  children?: ReactNode;
};

/** True for fenced blocks (with or without a language tag). */
export function isMarkdownCodeBlock(
  className: string | undefined,
  children: ReactNode,
): boolean {
  if (className) return true;
  const text = extractCodeText(children);
  return text.includes("\n");
}

function extractCodeText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractCodeText).join("");
  }
  return "";
}

/** Shared fenced/inline code rendering for slide + document markdown. */
export function MarkdownCode({
  className,
  children,
  blockClassName,
  inlineClassName,
}: CodeProps & {
  blockClassName?: string;
  inlineClassName?: string;
}) {
  if (isMarkdownCodeBlock(className, children)) {
    return (
      <code className={cn("font-mono", blockClassName, className)}>
        {children}
      </code>
    );
  }

  return (
    <code className={cn("font-mono", inlineClassName)}>{children}</code>
  );
}
