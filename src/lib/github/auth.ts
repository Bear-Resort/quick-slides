const TOKEN_KEY = "quick-slides.github.token";
const PROFILE_KEY = "quick-slides.github.profile";

const OAUTH_BASE = "/github-oauth";
const OAUTH_SCOPES = "repo";
const USER_AGENT = "Quick-Slides";

export type GithubAuthStatus = {
  signedIn: boolean;
  login?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  scopes?: string | null;
};

export type GithubDeviceStart = {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
};

export type GithubDevicePollResult = {
  status: "pending" | "slow_down" | "signed_in" | "expired" | "denied" | "error";
  message?: string | null;
  auth?: GithubAuthStatus | null;
};

type StoredProfile = {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  scopes: string | null;
};

function clientId(): string {
  const id = (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined)?.trim() ?? "";
  if (!id) {
    throw new Error(
      "GitHub Client ID is not configured. Set VITE_GITHUB_CLIENT_ID in .env.local (see .env.example).",
    );
  }
  return id;
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function readProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    if (!parsed?.login) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProfile(profile: StoredProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getAuthStatus(): GithubAuthStatus {
  const token = getAccessToken();
  if (!token) return { signedIn: false };
  const profile = readProfile();
  if (!profile) {
    return { signedIn: true, login: null, name: null, avatarUrl: null };
  }
  return {
    signedIn: true,
    login: profile.login,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    scopes: profile.scopes,
  };
}

export function signOut(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

async function fetchUserProfile(token: string): Promise<StoredProfile> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load GitHub profile (${response.status})`);
  }
  const data = (await response.json()) as {
    login: string;
    name?: string | null;
    avatar_url?: string | null;
  };
  return {
    login: data.login,
    name: data.name ?? null,
    avatarUrl: data.avatar_url ?? null,
    scopes: null,
  };
}

export async function refreshAuthStatus(): Promise<GithubAuthStatus> {
  const token = getAccessToken();
  if (!token) {
    signOut();
    return { signedIn: false };
  }
  try {
    const profile = await fetchUserProfile(token);
    writeProfile(profile);
    return {
      signedIn: true,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      scopes: profile.scopes,
    };
  } catch {
    signOut();
    return { signedIn: false };
  }
}

export async function githubDeviceStart(): Promise<GithubDeviceStart> {
  const body = new URLSearchParams({
    client_id: clientId(),
    scope: OAUTH_SCOPES,
  });
  const response = await fetch(`${OAUTH_BASE}/login/device/code`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Device login failed (${response.status}): ${text || response.statusText}`);
  }
  const data = (await response.json()) as {
    user_code: string;
    device_code: string;
    verification_uri: string;
    interval?: number;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  return {
    userCode: data.user_code,
    deviceCode: data.device_code,
    verificationUri: data.verification_uri,
    interval: data.interval ?? 5,
    expiresIn: data.expires_in ?? 900,
  };
}

export async function githubDevicePoll(
  deviceCode: string,
): Promise<GithubDevicePollResult> {
  const body = new URLSearchParams({
    client_id: clientId(),
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const response = await fetch(`${OAUTH_BASE}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    return {
      status: "error",
      message: `Token request failed (${response.status})`,
    };
  }
  const data = (await response.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.access_token) {
    setAccessToken(data.access_token);
    const profile = await fetchUserProfile(data.access_token);
    profile.scopes = data.scope ?? null;
    writeProfile(profile);
    return {
      status: "signed_in",
      auth: {
        signedIn: true,
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        scopes: profile.scopes,
      },
    };
  }

  switch (data.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "slow_down" };
    case "expired_token":
      return { status: "expired", message: data.error_description ?? null };
    case "access_denied":
      return { status: "denied", message: data.error_description ?? null };
    default:
      return {
        status: "error",
        message: data.error_description || data.error || "Unknown error",
      };
  }
}
