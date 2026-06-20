import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveEditorImageSrc } from "@/lib/editorImages";
import type { SlideImage as SlideImageData } from "@/lib/slideLayout";

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
      className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-300 bg-secondary/50 p-8 text-muted-foreground dark:border-gray-700"
      aria-label={alt || "Image placeholder"}
    >
      <ImageIcon className="size-16" />
      {alt && <span className="text-lg font-medium">{alt}</span>}
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

export function SlideImagePanel({ image, variant = "default" }: SlideImageProps) {
  const resolvedSrc = resolveEditorImageSrc(image.src);
  const hasSrc = Boolean(resolvedSrc);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showPlaceholder = !hasSrc || !loaded || failed;
  const isHero = variant === "hero";

  return (
    <div
      className={cn(
        "slide-image-panel relative flex min-h-0 w-full items-center justify-center",
        isHero ? "h-full max-h-full" : "h-full",
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
            isHero ? "max-h-full w-full max-w-full" : "max-h-full max-w-full",
            !loaded && "sr-only",
          )}
        />
      )}
    </div>
  );
}
