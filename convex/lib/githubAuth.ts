export type GithubIdentity = {
  login: string;
  id: string;
};

export async function verifyGithubToken(
  token: string | undefined | null,
): Promise<GithubIdentity | null> {
  const trimmed = token?.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${trimmed}`,
        "User-Agent": "Quick-Slides",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      login?: unknown;
      id?: unknown;
    };
    if (typeof data.login !== "string" || !data.login.trim()) return null;
    const id =
      typeof data.id === "number" || typeof data.id === "string"
        ? String(data.id)
        : "";
    if (!id) return null;
    return { login: data.login.trim(), id };
  } catch {
    return null;
  }
}

export function bearerFromAuthorizationHeader(
  header: string | null,
): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
