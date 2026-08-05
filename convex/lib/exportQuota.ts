export const ADMIN_LOGIN = "James-Guo-03";

export function isAdminLogin(login: string | null | undefined): boolean {
  return (login ?? "").toLowerCase() === ADMIN_LOGIN.toLowerCase();
}

export const FREE_WEEKLY = 3;
export const PREMIUM_WEEKLY = 15;
export const PRO_WEEKLY = 40;
/** Display / soft cap only — admin plan skips quota enforcement. */
export const ADMIN_WEEKLY = 1_000_000;
export const GLOBAL_MONTHLY = 400;

export type ExportPlan = "free" | "premium" | "pro" | "admin";

export function isUnlimitedPlan(plan: ExportPlan): boolean {
  return plan === "admin";
}

export function weeklyLimitForPlan(plan: ExportPlan): number {
  if (plan === "admin") return ADMIN_WEEKLY;
  if (plan === "pro") return PRO_WEEKLY;
  if (plan === "premium") return PREMIUM_WEEKLY;
  return FREE_WEEKLY;
}

/** UTC Monday 00:00 for the week containing `now`. */
export function weekStartUtc(now: number): number {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const daysFromMonday = (day + 6) % 7;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - daysFromMonday,
    0,
    0,
    0,
    0,
  );
}

export function monthKeyUtc(now: number): string {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isExportPlan(value: string): value is ExportPlan {
  return (
    value === "free" ||
    value === "premium" ||
    value === "pro" ||
    value === "admin"
  );
}
