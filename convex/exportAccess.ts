import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  ADMIN_LOGIN,
  GLOBAL_MONTHLY,
  isAdminLogin,
  isExportPlan,
  isUnlimitedPlan,
  monthKeyUtc,
  type ExportPlan,
  weekStartUtc,
  weeklyLimitForPlan,
} from "./lib/exportQuota";
import { verifyGithubToken } from "./lib/githubAuth";

const planValidator = v.union(
  v.literal("free"),
  v.literal("premium"),
  v.literal("pro"),
  v.literal("admin"),
);

const entitlementValidator = v.object({
  signedIn: v.boolean(),
  login: v.union(v.string(), v.null()),
  plan: planValidator,
  weeklyLimit: v.number(),
  weeklyUsed: v.number(),
  weeklyRemaining: v.number(),
  globalRemaining: v.number(),
  canSelectable: v.boolean(),
  reason: v.union(v.string(), v.null()),
  pendingPremiumRequest: v.boolean(),
});

type Entitlement = {
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

type UsageSnapshot = {
  plan: ExportPlan;
  weeklyUsed: number;
  weeklyLimit: number;
  globalUsed: number;
  globalLimit: number;
  pendingPremiumRequest: boolean;
};

type PremiumRequestRow = {
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

type AdminUserRow = {
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

async function getPlanForLogin(
  ctx: QueryCtx | MutationCtx,
  githubLogin: string,
): Promise<ExportPlan> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
    .unique();
  return user?.plan ?? "free";
}

async function ensureUserRow(
  ctx: MutationCtx,
  githubLogin: string,
  githubId: string,
  now: number,
): Promise<void> {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_login", (q) => q.eq("githubLogin", githubLogin))
    .unique();
  const defaultPlan: ExportPlan = isAdminLogin(githubLogin) ? "admin" : "free";
  if (existing) {
    const patch: {
      githubId?: string;
      plan?: ExportPlan;
      updatedAt: number;
    } = { updatedAt: now };
    if (existing.githubId !== githubId && githubId !== "unknown") {
      patch.githubId = githubId;
    }
    // Keep the site admin account on the unlimited plan.
    if (isAdminLogin(githubLogin) && existing.plan !== "admin") {
      patch.plan = "admin";
    }
    if (patch.githubId !== undefined || patch.plan !== undefined) {
      await ctx.db.patch(existing._id, patch);
    }
    return;
  }
  await ctx.db.insert("users", {
    githubLogin,
    githubId,
    plan: defaultPlan,
    createdAt: now,
    updatedAt: now,
  });
}

export const getUsageSnapshot = internalQuery({
  args: {
    githubLogin: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.object({
    plan: planValidator,
    weeklyUsed: v.number(),
    weeklyLimit: v.number(),
    globalUsed: v.number(),
    globalLimit: v.number(),
    pendingPremiumRequest: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const weekStart = weekStartUtc(args.now);
    const monthKey = monthKeyUtc(args.now);

    const globalRow = await ctx.db
      .query("globalExportUsage")
      .withIndex("by_month", (q) => q.eq("monthKey", monthKey))
      .unique();
    const globalUsed = globalRow?.count ?? 0;

    if (!args.githubLogin) {
      return {
        plan: "free" as const,
        weeklyUsed: 0,
        weeklyLimit: weeklyLimitForPlan("free"),
        globalUsed,
        globalLimit: GLOBAL_MONTHLY,
        pendingPremiumRequest: false,
      };
    }

    const plan = await getPlanForLogin(ctx, args.githubLogin);
    const usage = await ctx.db
      .query("exportUsage")
      .withIndex("by_login_week", (q) =>
        q.eq("githubLogin", args.githubLogin!).eq("weekStart", weekStart),
      )
      .unique();

    const pending = await ctx.db
      .query("premiumRequests")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin!))
      .collect();
    const pendingPremiumRequest = pending.some((r) => r.status === "pending");

    return {
      plan,
      weeklyUsed: usage?.count ?? 0,
      weeklyLimit: weeklyLimitForPlan(plan),
      globalUsed,
      globalLimit: GLOBAL_MONTHLY,
      pendingPremiumRequest,
    };
  },
});

export const ensureUser = internalMutation({
  args: {
    githubLogin: v.string(),
    githubId: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureUserRow(ctx, args.githubLogin, args.githubId, args.now);
    return null;
  },
});

export const consumeSelectableExport = internalMutation({
  args: {
    githubLogin: v.string(),
    githubId: v.string(),
    now: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
    reason: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await ensureUserRow(ctx, args.githubLogin, args.githubId, args.now);

    const weekStart = weekStartUtc(args.now);
    const monthKey = monthKeyUtc(args.now);
    const plan = await getPlanForLogin(ctx, args.githubLogin);
    const unlimited = isUnlimitedPlan(plan);
    const weeklyLimit = weeklyLimitForPlan(plan);

    const usage = await ctx.db
      .query("exportUsage")
      .withIndex("by_login_week", (q) =>
        q.eq("githubLogin", args.githubLogin).eq("weekStart", weekStart),
      )
      .unique();
    const weeklyUsed = usage?.count ?? 0;
    if (!unlimited && weeklyUsed >= weeklyLimit) {
      return {
        ok: false,
        error: "weekly_quota_exceeded",
        reason: `Weekly selectable PDF quota used (${weeklyUsed}/${weeklyLimit}).`,
      };
    }

    const globalRow = await ctx.db
      .query("globalExportUsage")
      .withIndex("by_month", (q) => q.eq("monthKey", monthKey))
      .unique();
    const globalUsed = globalRow?.count ?? 0;
    if (!unlimited && globalUsed >= GLOBAL_MONTHLY) {
      return {
        ok: false,
        error: "global_quota_exceeded",
        reason: "Global selectable PDF capacity for this month is exhausted.",
      };
    }

    if (usage) {
      await ctx.db.patch(usage._id, { count: weeklyUsed + 1 });
    } else {
      await ctx.db.insert("exportUsage", {
        githubLogin: args.githubLogin,
        weekStart,
        count: 1,
      });
    }

    // Unlimited (admin) users do not consume the shared monthly pool.
    if (!unlimited) {
      if (globalRow) {
        await ctx.db.patch(globalRow._id, { count: globalUsed + 1 });
      } else {
        await ctx.db.insert("globalExportUsage", {
          monthKey,
          count: 1,
        });
      }
    }

    return { ok: true, error: null, reason: null };
  },
});

export const insertPremiumRequest = internalMutation({
  args: {
    githubLogin: v.string(),
    githubId: v.string(),
    message: v.optional(v.string()),
    now: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await ensureUserRow(ctx, args.githubLogin, args.githubId, args.now);

    const existing = await ctx.db
      .query("premiumRequests")
      .withIndex("by_login", (q) => q.eq("githubLogin", args.githubLogin))
      .collect();
    if (existing.some((r) => r.status === "pending")) {
      return { ok: false, error: "already_pending" };
    }

    await ctx.db.insert("premiumRequests", {
      githubLogin: args.githubLogin,
      githubId: args.githubId,
      message: args.message?.trim() || undefined,
      status: "pending",
      createdAt: args.now,
    });
    return { ok: true, error: null };
  },
});

export const adminListPremiumRequests = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("premiumRequests"),
      githubLogin: v.string(),
      githubId: v.string(),
      message: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
      plan: planValidator,
    }),
  ),
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const approved = await ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const rejected = await ctx.db
      .query("premiumRequests")
      .withIndex("by_status", (q) => q.eq("status", "rejected"))
      .collect();

    const merged = [...pending, ...approved, ...rejected]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);

    const results = [];
    for (const row of merged) {
      const plan = await getPlanForLogin(ctx, row.githubLogin);
      results.push({
        _id: row._id,
        githubLogin: row.githubLogin,
        githubId: row.githubId,
        message: row.message,
        status: row.status,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
        resolvedBy: row.resolvedBy,
        plan,
      });
    }
    return results;
  },
});

export const adminListUsers = internalQuery({
  args: {
    now: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      githubLogin: v.string(),
      githubId: v.string(),
      plan: planValidator,
      weeklyUsed: v.number(),
      weeklyLimit: v.number(),
      pendingPremiumRequest: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const weekStart = weekStartUtc(args.now);
    // Admin roster is small; collect all known export users.
    const users = await ctx.db.query("users").collect();
    users.sort((a, b) => b.updatedAt - a.updatedAt);

    const results: AdminUserRow[] = [];
    for (const user of users) {
      const usage = await ctx.db
        .query("exportUsage")
        .withIndex("by_login_week", (q) =>
          q.eq("githubLogin", user.githubLogin).eq("weekStart", weekStart),
        )
        .unique();
      const requests = await ctx.db
        .query("premiumRequests")
        .withIndex("by_login", (q) => q.eq("githubLogin", user.githubLogin))
        .collect();
      results.push({
        _id: user._id,
        githubLogin: user.githubLogin,
        githubId: user.githubId,
        plan: user.plan,
        weeklyUsed: usage?.count ?? 0,
        weeklyLimit: weeklyLimitForPlan(user.plan),
        pendingPremiumRequest: requests.some((r) => r.status === "pending"),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }
    return results;
  },
});

export const adminSetUserPlan = internalMutation({
  args: {
    githubLogin: v.string(),
    plan: planValidator,
    adminLogin: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const login = args.githubLogin.trim().replace(/^@/, "");
    if (!login) throw new Error("githubLogin is required");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_login", (q) => q.eq("githubLogin", login))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("users", {
        githubLogin: login,
        githubId: "unknown",
        plan: args.plan,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    if (
      args.plan === "premium" ||
      args.plan === "pro" ||
      args.plan === "admin"
    ) {
      const requests = await ctx.db
        .query("premiumRequests")
        .withIndex("by_login", (q) => q.eq("githubLogin", login))
        .collect();
      for (const req of requests) {
        if (req.status === "pending") {
          await ctx.db.patch(req._id, {
            status: "approved",
            resolvedAt: args.now,
            resolvedBy: args.adminLogin,
          });
        }
      }
    }

    return null;
  },
});

export const adminRejectPremiumRequest = internalMutation({
  args: {
    requestId: v.id("premiumRequests"),
    adminLogin: v.string(),
    now: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const req = await ctx.db.get(args.requestId);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") return null;
    await ctx.db.patch(args.requestId, {
      status: "rejected",
      resolvedAt: args.now,
      resolvedBy: args.adminLogin,
    });
    return null;
  },
});

export const getEntitlement = action({
  args: {
    githubToken: v.optional(v.string()),
  },
  returns: entitlementValidator,
  handler: async (ctx, args): Promise<Entitlement> => {
    const now = Date.now();
    const identity = await verifyGithubToken(args.githubToken);

    if (!identity) {
      const snap: UsageSnapshot = await ctx.runQuery(
        internal.exportAccess.getUsageSnapshot,
        { now },
      );
      return {
        signedIn: false,
        login: null,
        plan: "free",
        weeklyLimit: snap.weeklyLimit,
        weeklyUsed: 0,
        weeklyRemaining: 0,
        globalRemaining: Math.max(0, snap.globalLimit - snap.globalUsed),
        canSelectable: false,
        reason: "sign_in_required",
        pendingPremiumRequest: false,
      };
    }

    await ctx.runMutation(internal.exportAccess.ensureUser, {
      githubLogin: identity.login,
      githubId: identity.id,
      now,
    });

    const snap: UsageSnapshot = await ctx.runQuery(
      internal.exportAccess.getUsageSnapshot,
      {
        githubLogin: identity.login,
        now,
      },
    );

    const unlimited = isUnlimitedPlan(snap.plan);
    const weeklyRemaining = unlimited
      ? snap.weeklyLimit
      : Math.max(0, snap.weeklyLimit - snap.weeklyUsed);
    const globalRemaining = unlimited
      ? snap.globalLimit
      : Math.max(0, snap.globalLimit - snap.globalUsed);
    let reason: string | null = null;
    let canSelectable = true;
    if (!unlimited && weeklyRemaining <= 0) {
      canSelectable = false;
      reason = "weekly_quota_exceeded";
    } else if (!unlimited && globalRemaining <= 0) {
      canSelectable = false;
      reason = "global_quota_exceeded";
    }

    return {
      signedIn: true,
      login: identity.login,
      plan: snap.plan,
      weeklyLimit: snap.weeklyLimit,
      weeklyUsed: snap.weeklyUsed,
      weeklyRemaining,
      globalRemaining,
      canSelectable,
      reason,
      pendingPremiumRequest: snap.pendingPremiumRequest,
    };
  },
});

export const requestPremium = action({
  args: {
    githubToken: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error: string | null }> => {
    const identity = await verifyGithubToken(args.githubToken);
    if (!identity) {
      return { ok: false, error: "not_authenticated" };
    }
    const result: { ok: boolean; error: string | null } =
      await ctx.runMutation(internal.exportAccess.insertPremiumRequest, {
        githubLogin: identity.login,
        githubId: identity.id,
        message: args.message,
        now: Date.now(),
      });
    return result;
  },
});

export const listPremiumRequests = action({
  args: {
    githubToken: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
    requests: v.array(
      v.object({
        _id: v.id("premiumRequests"),
        githubLogin: v.string(),
        githubId: v.string(),
        message: v.optional(v.string()),
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        createdAt: v.number(),
        resolvedAt: v.optional(v.number()),
        resolvedBy: v.optional(v.string()),
        plan: planValidator,
      }),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    error: string | null;
    requests: PremiumRequestRow[];
  }> => {
    const identity = await verifyGithubToken(args.githubToken);
    if (!identity || !isAdminLogin(identity.login)) {
      return { ok: false, error: "forbidden", requests: [] };
    }
    const requests: PremiumRequestRow[] = await ctx.runQuery(
      internal.exportAccess.adminListPremiumRequests,
      {},
    );
    return { ok: true, error: null, requests };
  },
});

export const listUsers = action({
  args: {
    githubToken: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
    users: v.array(
      v.object({
        _id: v.id("users"),
        githubLogin: v.string(),
        githubId: v.string(),
        plan: planValidator,
        weeklyUsed: v.number(),
        weeklyLimit: v.number(),
        pendingPremiumRequest: v.boolean(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    error: string | null;
    users: AdminUserRow[];
  }> => {
    const identity = await verifyGithubToken(args.githubToken);
    if (!identity || !isAdminLogin(identity.login)) {
      return { ok: false, error: "forbidden", users: [] };
    }
    const users: AdminUserRow[] = await ctx.runQuery(
      internal.exportAccess.adminListUsers,
      { now: Date.now() },
    );
    return { ok: true, error: null, users };
  },
});

export const setUserPlan = action({
  args: {
    githubToken: v.string(),
    githubLogin: v.string(),
    plan: planValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error: string | null }> => {
    const identity = await verifyGithubToken(args.githubToken);
    if (!identity || !isAdminLogin(identity.login)) {
      return { ok: false, error: "forbidden" };
    }
    if (!isExportPlan(args.plan)) {
      return { ok: false, error: "invalid_plan" };
    }
    await ctx.runMutation(internal.exportAccess.adminSetUserPlan, {
      githubLogin: args.githubLogin,
      plan: args.plan,
      adminLogin: identity.login,
      now: Date.now(),
    });
    return { ok: true, error: null };
  },
});

export const rejectPremiumRequest = action({
  args: {
    githubToken: v.string(),
    requestId: v.id("premiumRequests"),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error: string | null }> => {
    const identity = await verifyGithubToken(args.githubToken);
    if (!identity || !isAdminLogin(identity.login)) {
      return { ok: false, error: "forbidden" };
    }
    await ctx.runMutation(internal.exportAccess.adminRejectPremiumRequest, {
      requestId: args.requestId as Id<"premiumRequests">,
      adminLogin: identity.login,
      now: Date.now(),
    });
    return { ok: true, error: null };
  },
});

export const adminLoginConstant = query({
  args: {},
  returns: v.string(),
  handler: async () => ADMIN_LOGIN,
});
