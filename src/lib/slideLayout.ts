export type SlideLayoutType = "title" | "subtitle" | "content";

export type SlideImage = {
  alt: string;
  src: string;
};

export type ParsedSlide = {
  layout: SlideLayoutType;
  body: string;
  image: SlideImage | null;
};

import {
  isImageAltPlaceholder,
  isImagePlaceholderUrl,
  SLIDE_IMAGE_PLACEHOLDER_LABEL,
} from "@/lib/editorPlaceholders";

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]*)\)/;

/** Extract the first markdown image and remove it from the body. */
function extractFirstImage(markdown: string): {
  body: string;
  image: SlideImage | null;
} {
  const match = IMAGE_PATTERN.exec(markdown);
  if (!match) {
    return { body: markdown.trim(), image: null };
  }

  const rawSrc = match[2]?.trim() ?? "";
  const rawAlt = match[1] ?? "";
  const image: SlideImage = {
    alt: isImageAltPlaceholder(rawAlt) ? SLIDE_IMAGE_PLACEHOLDER_LABEL : rawAlt,
    src: isImagePlaceholderUrl(rawSrc) ? "" : rawSrc,
  };

  const body = markdown.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim();
  return { body, image };
}

function getFirstHeadingLevel(markdown: string): number | null {
  const match = markdown.match(/^#{1,6}\s+/m);
  if (!match) return null;
  return match[0].trim().length;
}

/** `#` title slide; `##` subtitle slide; `###` content slide with fixed page title. */
export function parseSlide(markdown: string): ParsedSlide {
  const { body, image } = extractFirstImage(markdown);
  const headingLevel = getFirstHeadingLevel(body);

  let layout: SlideLayoutType = "content";
  if (headingLevel === 1) layout = "title";
  else if (headingLevel === 2) layout = "subtitle";

  return { layout, body, image };
}

export function isVerticallyCenteredLayout(layout: SlideLayoutType): boolean {
  return layout === "title" || layout === "subtitle";
}

/** True when the slide has body text beyond its primary heading/title. */
export function hasSlideTextContent(body: string, layout: SlideLayoutType): boolean {
  if (layout === "title") {
    return body.replace(/^#\s+[^\n]*(?:\n|$)/, "").trim().length > 0;
  }
  if (layout === "subtitle") {
    return body.replace(/^##\s+[^\n]*(?:\n|$)/, "").trim().length > 0;
  }
  return splitContentHeading(body).rest.trim().length > 0;
}

/** Split the first markdown heading from the rest of a content slide body. */
export function splitContentHeading(body: string): {
  headingText: string | null;
  rest: string;
} {
  const match = body.match(/^(#{1,6})\s+(.+?)(?:\n([\s\S]*))?$/);
  if (!match) {
    return { headingText: null, rest: body.trim() };
  }

  return {
    headingText: match[2]?.trim() ?? null,
    rest: (match[3] ?? "").trim(),
  };
}
