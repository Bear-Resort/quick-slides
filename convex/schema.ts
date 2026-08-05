import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const exportPlan = v.union(
  v.literal("free"),
  v.literal("premium"),
  v.literal("pro"),
  v.literal("admin"),
);

const premiumRequestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export default defineSchema({
  users: defineTable({
    githubLogin: v.string(),
    githubId: v.string(),
    plan: exportPlan,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_login", ["githubLogin"]),

  exportUsage: defineTable({
    githubLogin: v.string(),
    weekStart: v.number(),
    count: v.number(),
  }).index("by_login_week", ["githubLogin", "weekStart"]),

  globalExportUsage: defineTable({
    monthKey: v.string(),
    count: v.number(),
  }).index("by_month", ["monthKey"]),

  premiumRequests: defineTable({
    githubLogin: v.string(),
    githubId: v.string(),
    message: v.optional(v.string()),
    status: premiumRequestStatus,
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_login", ["githubLogin"]),
});
