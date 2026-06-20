import { useState } from "react";
import { ChevronDown, Download, Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadSlidesHtml, downloadSlidesPdf } from "@/lib/exportSlides";
import type { SlideThemeId } from "@/lib/slideThemes";
import { getTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    present: "Present",
    download: "Download",
    downloadPdf: "PDF",
    downloadHtml: "HTML (presentation)",
    exportingPdf: "Exporting PDF…",
    exportingHtml: "Exporting HTML…",
    exportFailed: "Export failed. Please try again.",
  },
  zh: {
    present: "演示",
    download: "下载",
    downloadPdf: "PDF",
    downloadHtml: "HTML（演示模式）",
    exportingPdf: "正在导出 PDF…",
    exportingHtml: "正在导出 HTML…",
    exportFailed: "导出失败，请重试。",
  },
};

type SlideActionsProps = {
  markdown: string;
  theme: SlideThemeId;
  onPresent: () => void;
};

export function SlideActions({ markdown, theme, onPresent }: SlideActionsProps) {
  const language = useLanguage();
  const t = copy[language];
  const [exporting, setExporting] = useState<"pdf" | "html" | null>(null);

  const handlePdfExport = async () => {
    if (exporting) return;
    setExporting("pdf");
    try {
      await downloadSlidesPdf(markdown, theme, getTheme());
    } catch (error) {
      console.error("PDF export failed:", error);
      window.alert(t.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const handleHtmlExport = async () => {
    if (exporting) return;
    setExporting("html");
    try {
      await downloadSlidesHtml(markdown, theme, getTheme());
    } catch (error) {
      console.error("HTML export failed:", error);
      window.alert(t.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPresent}
        className="slide-action-present inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Play className="size-3.5 fill-current" aria-hidden="true" />
        {t.present}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={exporting !== null}
            className="slide-action-download inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {exporting === "pdf"
              ? t.exportingPdf
              : exporting === "html"
                ? t.exportingHtml
                : t.download}
            <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handlePdfExport()}>
            {t.downloadPdf}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleHtmlExport()}>
            {t.downloadHtml}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
