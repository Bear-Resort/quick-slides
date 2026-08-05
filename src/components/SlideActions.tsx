import { useEffect, useState } from "react";
import {
  Download,
  FileCode2,
  FileImage,
  FileText,
  Loader2,
  Lock,
  Play,
  X,
} from "lucide-react";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { convexConfigured } from "@/lib/convex";
import {
  fetchExportEntitlement,
  submitPremiumRequest,
  type ExportEntitlement,
} from "@/lib/exportAccessClient";
import { getAccessToken, getAuthStatus } from "@/lib/github/auth";
import {
  downloadSlidesHtml,
  downloadSlidesPdf,
  downloadSlidesPdfImage,
  SelectablePdfEntitlementError,
} from "@/lib/exportSlides";
import type { SlideColorMode, SlideThemeId } from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    present: "Present",
    download: "Download",
    title: "Download",
    close: "Close",
    selectable: "PDF (selectable text)",
    selectableHint: "Clean text PDF via server print",
    image: "PDF (image)",
    imageHint: "Rasterized slides — works offline",
    html: "HTML (presentation)",
    htmlHint: "Standalone viewer in the browser",
    remaining: "Remaining this week",
    unlimited: "Unlimited",
    signInRequired: "Sign in with GitHub to unlock",
    quotaUsed: "Weekly quota used",
    globalFull: "Server capacity full this month",
    requestPremium: "Request premium",
    requestSent: "Request sent — we'll review it soon",
    alreadyPending: "Premium request already pending",
    requestFailed: "Could not send request",
    exportingPdf: "Exporting PDF…",
    exportingPdfImage: "Exporting PDF…",
    exportingHtml: "Exporting HTML…",
    exportFailed: "Export failed. Please try again.",
    loading: "Checking access…",
    convexMissing: "Export backend is not configured",
    openGithub: "Open the GitHub panel to sign in",
  },
  zh: {
    present: "演示",
    download: "下载",
    title: "下载",
    close: "关闭",
    selectable: "PDF（可选中文字）",
    selectableHint: "服务端打印的清晰文字 PDF",
    image: "PDF（图片）",
    imageHint: "幻灯片截图 — 可离线使用",
    html: "HTML（演示模式）",
    htmlHint: "独立浏览器演示页",
    remaining: "本周剩余",
    unlimited: "无限制",
    signInRequired: "登录 GitHub 后可用",
    quotaUsed: "本周配额已用完",
    globalFull: "本月服务端额度已满",
    requestPremium: "申请高级额度",
    requestSent: "已提交申请，我们会尽快处理",
    alreadyPending: "已有待处理的申请",
    requestFailed: "提交失败",
    exportingPdf: "正在导出 PDF…",
    exportingPdfImage: "正在导出 PDF…",
    exportingHtml: "正在导出 HTML…",
    exportFailed: "导出失败，请重试。",
    loading: "正在检查权限…",
    convexMissing: "导出后端未配置",
    openGithub: "请在 GitHub 面板登录",
  },
};

type SlideActionsProps = {
  markdown: string;
  theme: SlideThemeId;
  colorMode: SlideColorMode;
  filename: string;
  deckHandle?: FileSystemDirectoryHandle | null;
  deckId?: string | null;
  onPresent: () => void;
};

export function SlideActions({
  markdown,
  theme,
  colorMode,
  filename,
  deckHandle = null,
  deckId = null,
  onPresent,
}: SlideActionsProps) {
  const language = useLanguage();
  const t = copy[language];
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "pdf-image" | "html" | null>(
    null,
  );
  const [entitlement, setEntitlement] = useState<ExportEntitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshEntitlement = async () => {
    if (!convexConfigured) {
      setEntitlement(null);
      return;
    }
    setEntitlementLoading(true);
    try {
      const result = await fetchExportEntitlement(getAccessToken());
      setEntitlement(result);
    } catch (error) {
      console.error("Failed to load export entitlement", error);
      setEntitlement(null);
    } finally {
      setEntitlementLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStatusMessage(null);
    setErrorMessage(null);
    void refreshEntitlement();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && exporting === null) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, exporting]);

  const busy = exporting !== null;

  const handlePdfExport = async () => {
    if (exporting) return;
    const token = getAccessToken();
    setExporting("pdf");
    setErrorMessage(null);
    try {
      await downloadSlidesPdf(
        markdown,
        theme,
        colorMode,
        filename,
        deckHandle,
        deckId,
        token,
      );
      setOpen(false);
      void refreshEntitlement();
    } catch (error) {
      console.error("PDF export failed:", error);
      if (error instanceof SelectablePdfEntitlementError) {
        setErrorMessage(error.message);
        void refreshEntitlement();
      } else {
        const message = error instanceof Error ? error.message : "";
        setErrorMessage(message ? `${t.exportFailed}\n${message}` : t.exportFailed);
      }
    } finally {
      setExporting(null);
    }
  };

  const handlePdfImageExport = async () => {
    if (exporting) return;
    setExporting("pdf-image");
    setErrorMessage(null);
    try {
      await downloadSlidesPdfImage(
        markdown,
        theme,
        colorMode,
        filename,
        deckHandle,
        deckId,
      );
      setOpen(false);
    } catch (error) {
      console.error("PDF image export failed:", error);
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(message ? `${t.exportFailed}\n${message}` : t.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const handleHtmlExport = async () => {
    if (exporting) return;
    setExporting("html");
    setErrorMessage(null);
    try {
      await downloadSlidesHtml(
        markdown,
        theme,
        colorMode,
        filename,
        deckHandle,
        deckId,
      );
      setOpen(false);
    } catch (error) {
      console.error("HTML export failed:", error);
      setErrorMessage(t.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const handleRequestPremium = async () => {
    const token = getAccessToken();
    if (!token || !convexConfigured) return;
    setErrorMessage(null);
    try {
      const result = await submitPremiumRequest(token);
      if (result.ok) {
        setStatusMessage(t.requestSent);
        void refreshEntitlement();
      } else if (result.error === "already_pending") {
        setStatusMessage(t.alreadyPending);
      } else {
        setErrorMessage(t.requestFailed);
      }
    } catch {
      setErrorMessage(t.requestFailed);
    }
  };

  const selectableLocked = !entitlement?.canSelectable;
  const selectableReasonLabel = (() => {
    if (entitlementLoading) return t.loading;
    if (!convexConfigured) return t.convexMissing;
    if (!entitlement?.signedIn) {
      const auth = getAuthStatus();
      return auth.signedIn ? t.loading : t.signInRequired;
    }
    if (entitlement.reason === "weekly_quota_exceeded") return t.quotaUsed;
    if (entitlement.reason === "global_quota_exceeded") return t.globalFull;
    return null;
  })();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPresent}
        aria-label={t.present}
        title={t.present}
        className="panel-chrome-action slide-action-present glass-primary inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
      >
        <Play className="size-3.5 shrink-0 fill-current" aria-hidden="true" />
        <span className="panel-chrome-action-label">{t.present}</span>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.download}
        title={t.download}
        aria-busy={busy || undefined}
        disabled={busy}
        className="panel-chrome-action slide-action-download glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        {busy ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="panel-chrome-action-label">{t.download}</span>
      </button>

      {open ? (
        <DialogPortal>
          <div
            className="fixed inset-0 z-[340] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
            onClick={() => {
              if (!busy) setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="download-dialog-title"
              className="glass-panel glass-panel-dialog w-full max-w-md rounded-xl border p-5 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h2
                  id="download-dialog-title"
                  className="text-base font-semibold"
                >
                  {t.title}
                </h2>
                <button
                  type="button"
                  aria-label={t.close}
                  disabled={busy}
                  className="glass-toolbar-action inline-flex size-8 items-center justify-center rounded-md"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={
                    busy ||
                    entitlementLoading ||
                    selectableLocked ||
                    !convexConfigured
                  }
                  onClick={() => void handlePdfExport()}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border border-white/15 px-3 py-3 text-left transition",
                    selectableLocked
                      ? "cursor-not-allowed opacity-60"
                      : "glass-toolbar-action hover:bg-white/10",
                  )}
                >
                  <div className="mt-0.5 text-foreground">
                    {exporting === "pdf" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : selectableLocked ? (
                      <Lock className="size-4" aria-hidden />
                    ) : (
                      <FileText className="size-4" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {exporting === "pdf" ? t.exportingPdf : t.selectable}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.selectableHint}
                    </p>
                    {entitlement?.signedIn ? (
                      <p className="mt-1 text-[11px] font-medium tabular-nums text-foreground/80">
                        {entitlement.plan === "admin"
                          ? `${t.unlimited} (${entitlement.plan})`
                          : `${t.remaining}: ${entitlement.weeklyRemaining}/${entitlement.weeklyLimit} (${entitlement.plan})`}
                      </p>
                    ) : null}
                    {selectableReasonLabel ? (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        {selectableReasonLabel}
                      </p>
                    ) : null}
                  </div>
                </button>

                {entitlement?.signedIn &&
                !entitlement.canSelectable &&
                entitlement.reason === "weekly_quota_exceeded" ? (
                  <button
                    type="button"
                    disabled={entitlement.pendingPremiumRequest}
                    onClick={() => void handleRequestPremium()}
                    className="glass-primary rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {entitlement.pendingPremiumRequest
                      ? t.alreadyPending
                      : t.requestPremium}
                  </button>
                ) : null}

                {!entitlement?.signedIn && !entitlementLoading ? (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    {t.openGithub}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePdfImageExport()}
                  className="glass-toolbar-action flex w-full items-start gap-3 rounded-lg border border-white/15 px-3 py-3 text-left"
                >
                  {exporting === "pdf-image" ? (
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <FileImage className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {exporting === "pdf-image"
                        ? t.exportingPdfImage
                        : t.image}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.imageHint}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleHtmlExport()}
                  className="glass-toolbar-action flex w-full items-start gap-3 rounded-lg border border-white/15 px-3 py-3 text-left"
                >
                  {exporting === "html" ? (
                    <Loader2
                      className="mt-0.5 size-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <FileCode2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {exporting === "html" ? t.exportingHtml : t.html}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.htmlHint}
                    </p>
                  </div>
                </button>
              </div>

              {statusMessage ? (
                <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                  {statusMessage}
                </p>
              ) : null}
              {errorMessage ? (
                <p className="mt-3 whitespace-pre-wrap text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>
        </DialogPortal>
      ) : null}
    </div>
  );
}
