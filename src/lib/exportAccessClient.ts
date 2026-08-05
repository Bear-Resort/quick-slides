import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convexConfigured } from "@/lib/convex";

function client(): ConvexHttpClient | null {
  const url = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim();
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export type ExportPlan = "free" | "premium" | "pro" | "admin";

export type ExportEntitlement = {
  signedIn: boolean;
  login: string | null;
  plan: ExportPlan;
  weeklyLimit: number;
  weeklyUsed: number;
  weeklyRemaining: number;
  globalRemaining: number;
  canSelectable: boolean;
  reason: string | null;
  pendingPremiumRequest: boolean;
};

export type PremiumRequestRow = {
  _id: Id<"premiumRequests">;
  githubLogin: string;
  githubId: string;
  message?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  plan: ExportPlan;
};

export type AdminUserRow = {
  _id: Id<"users">;
  githubLogin: string;
  githubId: string;
  plan: ExportPlan;
  weeklyUsed: number;
  weeklyLimit: number;
  pendingPremiumRequest: boolean;
  createdAt: number;
  updatedAt: number;
};

export async function fetchExportEntitlement(
  githubToken?: string | null,
): Promise<ExportEntitlement | null> {
  if (!convexConfigured) return null;
  const c = client();
  if (!c) return null;
  return await c.action(api.exportAccess.getEntitlement, {
    githubToken: githubToken ?? undefined,
  });
}

export async function submitPremiumRequest(
  githubToken: string,
  message?: string,
): Promise<{ ok: boolean; error: string | null }> {
  const c = client();
  if (!c) return { ok: false, error: "not_configured" };
  return await c.action(api.exportAccess.requestPremium, {
    githubToken,
    message,
  });
}

export async function fetchPremiumRequests(
  githubToken: string,
): Promise<{
  ok: boolean;
  error: string | null;
  requests: PremiumRequestRow[];
}> {
  const c = client();
  if (!c) return { ok: false, error: "not_configured", requests: [] };
  return await c.action(api.exportAccess.listPremiumRequests, { githubToken });
}

export async function fetchAdminUsers(
  githubToken: string,
): Promise<{
  ok: boolean;
  error: string | null;
  users: AdminUserRow[];
}> {
  const c = client();
  if (!c) return { ok: false, error: "not_configured", users: [] };
  return await c.action(api.exportAccess.listUsers, { githubToken });
}

export async function adminSetPlan(
  githubToken: string,
  githubLogin: string,
  plan: ExportPlan,
): Promise<{ ok: boolean; error: string | null }> {
  const c = client();
  if (!c) return { ok: false, error: "not_configured" };
  return await c.action(api.exportAccess.setUserPlan, {
    githubToken,
    githubLogin,
    plan,
  });
}

export async function adminRejectRequest(
  githubToken: string,
  requestId: Id<"premiumRequests">,
): Promise<{ ok: boolean; error: string | null }> {
  const c = client();
  if (!c) return { ok: false, error: "not_configured" };
  return await c.action(api.exportAccess.rejectPremiumRequest, {
    githubToken,
    requestId,
  });
}
