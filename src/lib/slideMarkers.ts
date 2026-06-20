import { splitSlides, splitSlidesWithMeta } from "@/lib/slides";

export type SeparatorMarker = {
  line: number;
  page: number;
  total: number;
};

export type SlideNavigation = {
  totalPages: number;
  separators: SeparatorMarker[];
  /** Editor line index (0-based) where each slide begins. */
  slideStartLines: number[];
};

export function getSlideNavigation(markdown: string): SlideNavigation {
  const slides = splitSlidesWithMeta(markdown);
  const totalPages = splitSlides(markdown).length;

  const separators: SeparatorMarker[] = slides.map((slide, index) => ({
    line: slide.markerLine,
    page: index + 1,
    total: totalPages,
  }));

  const slideStartLines = slides.map((slide) => slide.startLine);
  while (slideStartLines.length < totalPages) {
    const last = slideStartLines[slideStartLines.length - 1] ?? 0;
    slideStartLines.push(last);
  }
  slideStartLines.length = totalPages;

  return { totalPages, separators, slideStartLines };
}
