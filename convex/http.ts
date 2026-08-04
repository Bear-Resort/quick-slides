import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

/**
 * Proxies GitHub Device Flow POSTs so the GitHub Pages SPA can complete OAuth.
 * Browser → https://<deployment>.convex.site/github-oauth/... → github.com/login/...
 *
 * Set VITE_GITHUB_OAUTH_PROXY to https://<deployment>.convex.site/github-oauth
 */
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

export default http;
