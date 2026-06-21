import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { SlideFitContent } from "@/components/SlideFitContent";
import { SlideImagePanel } from "@/components/SlideImage";
import { normalizeDisplayMath, prepareSlideMarkdown } from "@/lib/markdown";
import { resolvePlaceholdersForSlide } from "@/lib/editorPlaceholders";
import {
  hasSlideTextContent,
  isVerticallyCenteredLayout,
  parseSlide,
  splitContentHeading,
  type SlideImage,
  type SlideLayoutType,
} from "@/lib/slideLayout";
import { cn } from "@/lib/utils";

type SlideViewProps = {
  markdown: string;
  className?: string;
  /** Disable content auto-scaling for export capture. */
  exportMode?: boolean;
};

/** Body text scale per slide type; headings keep fixed canvas sizes. */
const SLIDE_BODY_SCALE: Record<SlideLayoutType, string> = {
  title: "slide-text-title",
  subtitle: "slide-text-subtitle",
  content: "slide-text-content",
};

/** Typography is fixed to the 1280×720 canvas; preview scales the whole canvas. */
function createSlideComponents(layout: SlideLayoutType) {
  const isVerticallyCentered = isVerticallyCenteredLayout(layout);
  const bodyText =
    "slide-body-text text-left break-words [overflow-wrap:anywhere]";

  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1
        className={cn(
          "text-center text-5xl font-black leading-tight",
          layout === "title" && "slide-primary-heading",
        )}
      >
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2
        className={cn(
          "text-center leading-snug text-muted-foreground",
          layout === "title" ? "text-3xl font-medium" : "text-5xl font-semibold",
          layout === "subtitle" && "slide-primary-heading",
        )}
      >
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3
        className={cn(
          "mb-3 font-bold",
          layout === "subtitle"
            ? "text-center text-3xl font-semibold leading-snug text-muted-foreground"
            : "text-left text-4xl",
        )}
      >
        {children}
      </h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className={bodyText}>{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className={cn("slide-list-bulleted space-y-2", bodyText)}>{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className={cn("slide-list-ordered space-y-2", bodyText)}>{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className={bodyText}>{children}</li>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote
        className={cn(
          "text-left italic text-muted-foreground slide-body-text",
          isVerticallyCentered
            ? "border-none"
            : "border-l-4 border-gray-300 pl-5 dark:border-gray-700",
        )}
      >
        {children}
      </blockquote>
    ),
    img: () => null,
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
          <code className="slide-code-bg block overflow-x-auto rounded-lg p-[0.85em] font-mono text-[0.875em] text-left">
            {children}
          </code>
        );
      }
      return (
        <code className="slide-inline-code slide-code-bg rounded px-1.5 py-0.5 font-mono">
          {children}
        </code>
      );
    },
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="slide-code-bg overflow-x-auto rounded-lg p-[0.85em] font-mono text-[0.875em] text-left">
        {children}
      </pre>
    ),
    hr: () => null,
    table: ({ children }: { children?: ReactNode }) => (
      <div className="slide-table-wrap overflow-x-auto">
        <table className="slide-table text-left text-[0.925em]">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => (
      <thead className="slide-table-head">{children}</thead>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="slide-table-th px-4 py-2 font-semibold">{children}</th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="slide-table-td px-4 py-2">{children}</td>
    ),
  };
}

function slideBodyClassName(layout: SlideLayoutType): string {
  const scale = SLIDE_BODY_SCALE[layout];
  if (layout === "title") return cn("slide-title-body", scale, "space-y-0");
  if (layout === "subtitle") return cn("slide-subtitle-body", scale, "space-y-0");
  return cn("slide-content-body", scale, "space-y-4");
}

function SlideMarkdownBody({
  markdown,
  layout,
}: {
  markdown: string;
  layout: SlideLayoutType;
}) {
  const normalized = normalizeDisplayMath(
    prepareSlideMarkdown(resolvePlaceholdersForSlide(markdown)),
  );

  return (
    <div
      className={cn(
        "markdown-preview slide-content w-full leading-relaxed [&_a]:text-blue-600 dark:[&_a]:text-blue-400",
        slideBodyClassName(layout),
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={createSlideComponents(layout)}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function VerticallyCenteredSlideLayout({
  body,
  layout,
  className,
  exportMode,
}: {
  body: string;
  layout: "title" | "subtitle";
  className?: string;
  exportMode?: boolean;
}) {
  return (
    <div className={cn("h-full w-full px-16 py-12", className)}>
      <SlideFitContent verticalAlign="center" disableFit={exportMode}>
        <div className="mx-auto w-full max-w-4xl">
          <SlideMarkdownBody markdown={body} layout={layout} />
        </div>
      </SlideFitContent>
    </div>
  );
}

function ImageSlideTitleBlock({
  body,
  layout,
}: {
  body: string;
  layout: SlideLayoutType;
}) {
  const { headingText } = splitContentHeading(body);

  if (layout === "content" && headingText) {
    return (
      <h3 className="slide-content-heading shrink-0 text-5xl font-bold text-left">
        {headingText}
      </h3>
    );
  }

  return (
    <div className="shrink-0 px-4 pt-6">
      <SlideMarkdownBody
        markdown={body}
        layout={layout === "content" ? "content" : layout}
      />
    </div>
  );
}

function ImageHeroSlideLayout({
  body,
  layout,
  image,
  className,
}: {
  body: string;
  layout: SlideLayoutType;
  image: SlideImage;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full w-full flex-col px-12 pb-10", className)}>
      <ImageSlideTitleBlock body={body} layout={layout} />
      <div className="slide-sticker-shift-target flex min-h-0 flex-1 items-center justify-center pt-4">
        <SlideImagePanel image={image} variant="hero" />
      </div>
    </div>
  );
}

function DualImageSlideLayout({
  body,
  layout,
  images,
  className,
}: {
  body: string;
  layout: SlideLayoutType;
  images: [SlideImage, SlideImage];
  className?: string;
}) {
  return (
    <div className={cn("slide-content-layout flex h-full w-full flex-col px-12 pb-10", className)}>
      <ImageSlideTitleBlock body={body} layout={layout} />
      <div className="slide-sticker-shift-target grid min-h-0 flex-1 grid-cols-2 items-center gap-10 pt-4">
        <SlideImagePanel image={images[0]} variant="hero" />
        <SlideImagePanel image={images[1]} variant="hero" />
      </div>
    </div>
  );
}

function ContentSlideLayout({
  body,
  images = [],
  className,
  exportMode,
}: {
  body: string;
  images?: SlideImage[];
  className?: string;
  exportMode?: boolean;
}) {
  const image = images[0] ?? null;
  const secondImage = images[1] ?? null;
  const { headingText, rest } = splitContentHeading(body);
  const bodyMarkdown = headingText ? rest : body;

  const heading = headingText ? (
    <h3 className="slide-content-heading shrink-0 text-5xl font-bold text-left">
      {headingText}
    </h3>
  ) : null;

  const bodyContent = bodyMarkdown ? (
    <SlideFitContent
      verticalAlign="center"
      contentClassName="space-y-4"
      disableFit={exportMode}
    >
      <SlideMarkdownBody markdown={bodyMarkdown} layout="content" />
    </SlideFitContent>
  ) : null;

  if (image && !bodyMarkdown) {
    return (
      <ImageHeroSlideLayout
        body={body}
        layout="content"
        image={image}
        className={className}
      />
    );
  }

  if (image && secondImage && bodyMarkdown) {
    return (
      <div className={cn("slide-content-layout flex h-full w-full flex-col px-12 pb-10", className)}>
        {heading}
        <div className="slide-sticker-shift-target grid min-h-0 flex-1 grid-cols-3 items-center gap-6">
          <div className="slide-content-slide-body flex min-h-0 min-w-0 flex-col">
            {bodyContent}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <SlideImagePanel image={image} />
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <SlideImagePanel image={secondImage} />
          </div>
        </div>
      </div>
    );
  }

  if (image) {
    return (
      <div className={cn("slide-content-layout flex h-full w-full flex-col px-12 pb-10", className)}>
        {heading}
        <div className="slide-sticker-shift-target grid min-h-0 flex-1 grid-cols-2 items-center gap-10">
          <div className="slide-content-slide-body flex min-h-0 min-w-0 flex-col">
            {bodyContent}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <SlideImagePanel image={image} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("slide-content-layout flex h-full w-full flex-col px-12 pb-10", className)}>
      {heading}
      <div className="slide-content-slide-body min-h-0 flex-1">{bodyContent}</div>
    </div>
  );
}

export function SlideView({ markdown, className, exportMode = false }: SlideViewProps) {
  const resolved = prepareSlideMarkdown(resolvePlaceholdersForSlide(markdown));
  const { layout, body, images } = parseSlide(resolved);
  const image = images[0] ?? null;
  const isVerticallyCentered = isVerticallyCenteredLayout(layout);
  const hasText = hasSlideTextContent(body, layout);

  if (images.length >= 2 && !hasText) {
    return (
      <DualImageSlideLayout
        body={body}
        layout={layout}
        images={[images[0], images[1]]}
        className={className}
      />
    );
  }

  if (images.length >= 2 && hasText) {
    if (!isVerticallyCentered) {
      return (
        <ContentSlideLayout
          body={body}
          images={images}
          className={className}
          exportMode={exportMode}
        />
      );
    }

    return (
      <div
        className={cn(
          "slide-sticker-shift-target grid h-full w-full grid-cols-3 items-center gap-6 px-12 py-10",
          className,
        )}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <SlideFitContent verticalAlign="center" disableFit={exportMode}>
            <div className="mx-auto w-full max-w-xl">
              <SlideMarkdownBody
                markdown={body}
                layout={layout === "title" ? "title" : "subtitle"}
              />
            </div>
          </SlideFitContent>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <SlideImagePanel image={images[0]} />
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <SlideImagePanel image={images[1]} />
        </div>
      </div>
    );
  }

  if (image && !hasText) {
    return (
      <ImageHeroSlideLayout
        body={body}
        layout={layout}
        image={image}
        className={className}
      />
    );
  }

  if (image) {
    if (!isVerticallyCentered) {
      return (
        <ContentSlideLayout
          body={body}
          images={images}
          className={className}
          exportMode={exportMode}
        />
      );
    }

    return (
      <div
        className={cn(
          "slide-sticker-shift-target grid h-full w-full grid-cols-2 items-center gap-10 px-12 py-10",
          className,
        )}
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <SlideFitContent verticalAlign="center" disableFit={exportMode}>
            <div className="mx-auto w-full max-w-xl">
              <SlideMarkdownBody
                markdown={body}
                layout={layout === "title" ? "title" : "subtitle"}
              />
            </div>
          </SlideFitContent>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <SlideImagePanel image={image} />
        </div>
      </div>
    );
  }

  if (layout === "title" || layout === "subtitle") {
    return (
      <VerticallyCenteredSlideLayout
        body={body}
        layout={layout}
        className={className}
        exportMode={exportMode}
      />
    );
  }

  return <ContentSlideLayout body={body} className={className} exportMode={exportMode} />;
}
