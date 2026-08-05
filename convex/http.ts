/**
 * Convex HTTP:
 * - GitHub Device Flow OAuth proxy (`/github-oauth/…`)
 * - Selectable-text PDF via Browserless Chrome print (`/export-pdf`)
 *
 * Set on the Convex deployment:
 *   BROWSERLESS_API_TOKEN=...
 * Optional:
 *   BROWSERLESS_PDF_URL=https://production-sfo.browserless.io/pdf
 *
 * Client: POST { html: string } → application/pdf
 * Uses VITE_CONVEX_SITE_URL + /export-pdf
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_PATHS = new Set([
  "/login/device/code",
  "/login/oauth/access_token",
]);

const DEFAULT_BROWSERLESS_PDF_URL =
  "https://production-sfo.browserless.io/pdf";

/** Keep payloads reasonable for Browserless free tier (images are JPEG-compressed client-side). */
const MAX_HTML_CHARS = 5_000_000;

/** Free tier max session is 60s — stay well under that. */
const BROWSERLESS_GOTO_TIMEOUT_MS = 25_000;
/** Allow Noto Serif SC (Google Fonts) to finish loading so PDF matches preview. */
const BROWSERLESS_WAIT_MS = 2_000;

http.route({
  pathPrefix: "/github-oauth/",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }),
});

http.route({
  pathPrefix: "/github-oauth/",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const targetPath = url.pathname.slice("/github-oauth".length);

    if (!ALLOWED_PATHS.has(targetPath)) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      });
    }

    const target = `https://github.com${targetPath}`;
    const body = await request.text();

    try {
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            request.headers.get("Content-Type") ??
            "application/x-www-form-urlencoded",
          "User-Agent": "Quick-Slides-OAuth-Proxy",
        },
        body,
        redirect: "manual",
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type":
            upstream.headers.get("content-type") ?? "application/json",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "proxy_error",
          error_description:
            error instanceof Error ? error.message : "Failed to reach GitHub",
        }),
        {
          status: 502,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }
  }),
});

http.route({
  path: "/export-pdf",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }),
});

http.route({
  path: "/export-pdf",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const token = process.env.BROWSERLESS_API_TOKEN?.trim();
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "not_configured",
          error_description:
            "Set BROWSERLESS_API_TOKEN on the Convex deployment to enable selectable-text PDF export.",
        }),
        {
          status: 503,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let html = "";
    try {
      const payload: unknown = await request.json();
      if (
        payload &&
        typeof payload === "object" &&
        "html" in payload &&
        typeof (payload as { html: unknown }).html === "string"
      ) {
        html = (payload as { html: string }).html;
      }
    } catch {
      return new Response(
        JSON.stringify({
          error: "invalid_json",
          error_description: "Expected JSON body { html: string }",
        }),
        {
          status: 400,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!html.trim()) {
      return new Response(
        JSON.stringify({
          error: "missing_html",
          error_description: "html is required",
        }),
        {
          status: 400,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (html.length > MAX_HTML_CHARS) {
      return new Response(
        JSON.stringify({
          error: "html_too_large",
          error_description: `HTML exceeds ${MAX_HTML_CHARS} characters`,
        }),
        {
          status: 413,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const baseUrl =
      process.env.BROWSERLESS_PDF_URL?.trim() || DEFAULT_BROWSERLESS_PDF_URL;
    const endpoint = new URL(baseUrl);
    endpoint.searchParams.set("token", token);

    try {
      const upstream = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "User-Agent": "Quick-Slides-PDF-Export",
        },
        body: JSON.stringify({
          html,
          options: {
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            width: "1280px",
            height: "720px",
            margin: {
              top: "0",
              right: "0",
              bottom: "0",
              left: "0",
            },
          },
          // Wait for document + webfonts (Noto Serif SC) so print matches preview.
          gotoOptions: {
            waitUntil: "load",
            timeout: BROWSERLESS_GOTO_TIMEOUT_MS,
          },
          waitForTimeout: BROWSERLESS_WAIT_MS,
        }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        console.error(
          "Browserless PDF failed",
          upstream.status,
          detail.slice(0, 500),
        );
        const clipped = detail.replace(/\s+/g, " ").trim().slice(0, 240);
        return new Response(
          JSON.stringify({
            error: "render_failed",
            error_description: clipped
              ? `PDF renderer returned ${upstream.status}: ${clipped}`
              : `PDF renderer returned ${upstream.status}`,
          }),
          {
            status: 502,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const pdfBytes = await upstream.arrayBuffer();
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="slides.pdf"',
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("PDF export proxy error", error);
      return new Response(
        JSON.stringify({
          error: "proxy_error",
          error_description:
            error instanceof Error
              ? error.message
              : "Failed to reach PDF renderer",
        }),
        {
          status: 502,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }
  }),
});

export default http;
