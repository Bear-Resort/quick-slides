export type SlideLayoutType = "title" | "subtitle" | "content";

export type SlideImage = {
  alt: string;
  src: string;
};

export type ParsedSlide = {
  layout: SlideLayoutType;
  body: string;
  /** Up to two images extracted from slide markdown (in source order). */
  images: SlideImage[];
};

import {
  isImageAltPlaceholder,
  isImagePlaceholderUrl,
  SLIDE_IMAGE_PLACEHOLDER_LABEL,
} from "@/lib/editorPlaceholders";

const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]*)\)/g;

function parseImageMatch(match: RegExpExecArray): SlideImage {
  const rawSrc = match[2]?.trim() ?? "";
  const rawAlt = match[1] ?? "";
  return {
    alt: isImageAltPlaceholder(rawAlt) ? SLIDE_IMAGE_PLACEHOLDER_LABEL : rawAlt,
    src: isImagePlaceholderUrl(rawSrc) ? "" : rawSrc,
  };
}

/** Extract up to two markdown images and remove them from the body. */
function extractImages(markdown: string): {
  body: string;
  images: SlideImage[];
} {
  const matches = [...markdown.matchAll(IMAGE_PATTERN)];
  if (matches.length === 0) {
    return { body: markdown.trim(), images: [] };
  }

  const images = matches.slice(0, 2).map(parseImageMatch);
  let body = markdown;
  for (const match of matches.slice(0, 2)) {
    body = body.replace(match[0], "");
  }
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  return { body, images };
}

/** Caption text for a loaded slide image, or null when alt is empty/placeholder. */
export function getSlideImageCaption(alt: string): string | null {
  const trimmed = alt.trim();
  if (!trimmed || trimmed === SLIDE_IMAGE_PLACEHOLDER_LABEL) return null;
  if (isImageAltPlaceholder(trimmed)) return null;
  return trimmed;
}

function getFirstHeadingLevel(markdown: string): number | null {
  const match = markdown.match(/^#{1,6}\s+/m);
  if (!match) return null;
  return match[0].trim().length;
}

/** `#` title slide; `##` subtitle slide; `###` content slide with fixed page title. */
export function parseSlide(markdown: string): ParsedSlide {
  const { body, images } = extractImages(markdown);
  const headingLevel = getFirstHeadingLevel(body);

  let layout: SlideLayoutType = "content";
  if (headingLevel === 1) layout = "title";
  else if (headingLevel === 2) layout = "subtitle";

  return { layout, body, images };
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
