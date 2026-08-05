import { spawnSync } from "node:child_process";

/**
 * CI helper: Convex `deploy --cmd` injects VITE_CONVEX_URL; derive the HTTP
 * site URL for /export-pdf and /github-oauth when not already set.
 */
const env = { ...process.env };
const cloud = env.VITE_CONVEX_URL?.trim();
if (cloud && !env.VITE_CONVEX_SITE_URL?.trim()) {
  env.VITE_CONVEX_SITE_URL = cloud.replace(/\.convex\.cloud\/?$/, ".convex.site");
}

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["exec", "tsc", "-b"]);
run("pnpm", ["exec", "vite", "build"]);
