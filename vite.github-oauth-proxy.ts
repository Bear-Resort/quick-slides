import type { Connect, Plugin } from "vite";

/**
 * Forwards Device Flow POSTs to github.com.
 * Browser calls cannot hit github.com/login/* (CORS); GitHub Pages also rejects POST (405).
 */
function createGithubOauthMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? "";
    if (!url.startsWith("/github-oauth/")) {
      next();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const targetPath = url.slice("/github-oauth".length);
    const target = `https://github.com${targetPath}`;

    try {
      const upstream = await fetch(target, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            typeof req.headers["content-type"] === "string"
              ? req.headers["content-type"]
              : "application/x-www-form-urlencoded",
          "User-Agent": "Quick-Slides-OAuth-Proxy",
        },
        body,
        redirect: "manual",
      });
      const text = await upstream.text();
      res.statusCode = upstream.status;
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.end(text);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "proxy_error",
          error_description:
            error instanceof Error ? error.message : "Failed to reach GitHub",
        }),
      );
    }
  };
}

export function githubOauthProxyPlugin(): Plugin {
  const middleware = createGithubOauthMiddleware();
  return {
    name: "quick-slides-github-oauth-proxy",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
