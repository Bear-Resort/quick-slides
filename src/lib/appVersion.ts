/** App semver shown in the Bear Resort / what's-new dialog. */
export const APP_VERSION = "0.2.1";

const LAST_SEEN_KEY = "quick-slides.last-seen-version";

/** Prevents multiple Return mounts from each opening the dialog. */
let announceClaimed = false;

export function getLastSeenAppVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

/** True when this build has not been acknowledged in localStorage yet. */
export function shouldAnnounceAppVersion(): boolean {
  return getLastSeenAppVersion() !== APP_VERSION;
}

/**
 * Claim the one-time auto-open for this page load.
 * Returns true only for the first caller while the version is unseen.
 */
export function claimAppVersionAnnounce(): boolean {
  if (!shouldAnnounceAppVersion()) return false;
  if (announceClaimed) return false;
  announceClaimed = true;
  return true;
}

export function markAppVersionSeen(): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  } catch {
    // ignore quota / private mode
  }
  announceClaimed = false;
}
