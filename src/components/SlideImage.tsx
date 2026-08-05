import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { useDeckImageResolver } from "@/context/DeckContext";
import { cn } from "@/lib/utils";
import { isDeckImagePath } from "@/lib/library/deckFormat";
import { isEditorImageUrl, resolveEditorImageSrc } from "@/lib/editorImages";
import { getSlideImageCaption, type SlideImage as SlideImageData } from "@/lib/slideLayout";

type SlideImageProps = {
  image: SlideImageData;
  variant?: "default" | "hero";
};

function ImagePlaceholder({
  alt,
  message,
}: {
  alt: string;
  message?: string;
}) {
  return (
    <div
      className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-300 bg-secondary/50 p-8 text-muted-foreground dark:border-gray-700"
      aria-label={alt || "Image placeholder"}
    >
      <ImageIcon className="size-16" />
      {alt && <span className="text-lg font-medium">{alt}</span>}
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

function useResolvedSlideImageSrc(src: string): string {
  const { resolveImageSrc } = useDeckImageResolver();
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    if (isEditorImageUrl(src)) return resolveEditorImageSrc(src);
    if (isDeckImagePath(src)) return "";
    return src;
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (isEditorImageUrl(src)) {
        setResolvedSrc(resolveEditorImageSrc(src));
        return;
      }
      if (isDeckImagePath(src)) {
        const url = await resolveImageSrc(src);
        if (!cancelled) setResolvedSrc(url);
        return;
      }
      if (!cancelled) setResolvedSrc(src);
    })();

    return () => {
      cancelled = true;
    };
  }, [src, resolveImageSrc]);

  return resolvedSrc;
}

export function SlideImagePanel({ image, variant = "default" }: SlideImageProps) {
  const resolvedSrc = useResolvedSlideImageSrc(image.src);
  const hasSrc = Boolean(resolvedSrc);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [resolvedSrc]);

  const showPlaceholder = !hasSrc || !loaded || failed;
  const isHero = variant === "hero";
  const caption = getSlideImageCaption(image.alt);

  return (
    <figure className="slide-image-panel relative flex h-full max-h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden">
      <div
        className={cn(
          "flex min-h-0 w-full items-center justify-center overflow-hidden",
          caption ? "max-h-[calc(100%-2.75rem)]" : "max-h-full",
        )}
      >
        {showPlaceholder && (
          <ImagePlaceholder
            alt={image.alt}
            message={
              !hasSrc
                ? "No image URL"
                : failed
                  ? "Failed to load"
                  : "Loading…"
            }
          />
        )}
        {hasSrc && !failed && (
          <img
            src={resolvedSrc}
            alt={image.alt}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              "rounded-xl object-contain",
              "max-h-full max-w-full h-auto w-auto",
              isHero && "w-full",
              !loaded && "sr-only",
            )}
          />
        )}
      </div>
      {caption ? (
        <figcaption
          className={cn(
            "slide-image-caption shrink-0 pt-2 text-center text-foreground/70",
            isHero ? "text-2xl" : "text-xl",
          )}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
