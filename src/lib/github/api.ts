import { getAccessToken } from "@/lib/github/auth";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "Quick-Slides";

export type GithubRepo = {
  fullName: string;
  name: string;
  ownerLogin: string;
  private: boolean;
  description: string | null;
  htmlUrl: string;
  cloneUrl: string;
  updatedAt: string;
  defaultBranch: string;
};

export type GithubContentFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  content?: string;
  encoding?: string;
  downloadUrl?: string | null;
};

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  if (!token) throw new Error("Not signed in to GitHub");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
}

async function githubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const auth = authHeaders();
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value as string);
  }
  return fetch(`${GITHUB_API}${path}`, { ...init, headers });
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    if (data.message) return data.message;
  } catch {
    // ignore
  }
  return response.statusText || `HTTP ${response.status}`;
}

function mapRepo(raw: {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  description?: string | null;
  html_url: string;
  clone_url: string;
  updated_at: string;
  default_branch: string;
}): GithubRepo {
  return {
    fullName: raw.full_name,
    name: raw.name,
    ownerLogin: raw.owner.login,
    private: raw.private,
    description: raw.description ?? null,
    htmlUrl: raw.html_url,
    cloneUrl: raw.clone_url,
    updatedAt: raw.updated_at,
    defaultBranch: raw.default_branch,
  };
}

export async function listRepos(): Promise<GithubRepo[]> {
  const repos: GithubRepo[] = [];
  let page = 1;
  while (page <= 5) {
    const response = await githubFetch(
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    );
    if (!response.ok) throw new Error(await parseError(response));
    const batch = (await response.json()) as Array<Parameters<typeof mapRepo>[0]>;
    if (batch.length === 0) break;
    repos.push(...batch.map(mapRepo));
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

export async function createRepo(options: {
  name: string;
  privateRepo?: boolean;
  description?: string;
}): Promise<GithubRepo> {
  const response = await githubFetch("/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: options.name,
      private: options.privateRepo ?? true,
      description: options.description ?? "Quick Slides presentation",
      auto_init: true,
    }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return mapRepo((await response.json()) as Parameters<typeof mapRepo>[0]);
}

export async function getRepo(
  owner: string,
  repo: string,
): Promise<GithubRepo> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
  if (!response.ok) throw new Error(await parseError(response));
  return mapRepo((await response.json()) as Parameters<typeof mapRepo>[0]);
}

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GithubContentFile | null> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}${query}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as {
    name: string;
    path: string;
    sha: string;
    size: number;
    type: string;
    content?: string;
    encoding?: string;
    download_url?: string | null;
  };
  if (data.type !== "file") return null;
  return {
    name: data.name,
    path: data.path,
    sha: data.sha,
    size: data.size,
    type: "file",
    content: data.content,
    encoding: data.encoding,
    downloadUrl: data.download_url,
  };
}

export async function listDirectory(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GithubContentFile[]> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const encodedPath = path
    ? path
        .split("/")
        .map(encodeURIComponent)
        .join("/")
    : "";
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${query}`,
  );
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return (data as Array<{
    name: string;
    path: string;
    sha: string;
    size: number;
    type: string;
    download_url?: string | null;
  }>).map((item) => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    size: item.size,
    type: item.type === "dir" ? "dir" : "file",
    downloadUrl: item.download_url,
  }));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function putFile(options: {
  owner: string;
  repo: string;
  path: string;
  contentBase64: string;
  message: string;
  branch: string;
  sha?: string;
}): Promise<{ sha: string; commitSha: string }> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/contents/${options.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: options.message,
        content: options.contentBase64,
        branch: options.branch,
        ...(options.sha ? { sha: options.sha } : {}),
      }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
  const data = (await response.json()) as {
    content?: { sha?: string };
    commit?: { sha?: string };
  };
  return {
    sha: data.content?.sha ?? "",
    commitSha: data.commit?.sha ?? "",
  };
}

export async function deleteFile(options: {
  owner: string;
  repo: string;
  path: string;
  message: string;
  branch: string;
  sha: string;
}): Promise<void> {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(options.owner)}/${encodeURIComponent(options.repo)}/contents/${options.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: options.message,
        branch: options.branch,
        sha: options.sha,
      }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
}

export function encodeTextAsBase64(text: string): string {
  return toBase64(new TextEncoder().encode(text));
}

export function encodeBytesAsBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return toBase64(view);
}

export function decodeBase64ToText(content: string): string {
  const normalized = content.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function decodeBase64ToBytes(content: string): Uint8Array {
  const normalized = content.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
