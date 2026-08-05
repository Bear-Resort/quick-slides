import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminRejectRequest,
  adminSetPlan,
  fetchAdminUsers,
  fetchPremiumRequests,
  type AdminUserRow,
  type PremiumRequestRow,
} from "@/lib/exportAccessClient";
import { convexConfigured } from "@/lib/convex";
import { getAccessToken, getAuthStatus } from "@/lib/github/auth";
import { useLanguage } from "@/lib/useLanguage";

const ADMIN_LOGIN = "James-Guo-03";

function isAdminLogin(login: string | null | undefined): boolean {
  return (login ?? "").toLowerCase() === ADMIN_LOGIN.toLowerCase();
}

const copy = {
  en: {
    title: "Export admin",
    back: "Back to editor",
    denied: "Access denied",
    deniedHint: "Sign in with GitHub as the admin account to continue.",
    signedInAs: "Signed in as",
    notSignedIn: "Not signed in",
    loading: "Loading…",
    requests: "Premium requests",
    users: "All users",
    searchUsers: "Search users",
    searchPlaceholder: "Filter by GitHub username…",
    noSearchMatches: "No users match that search",
    empty: "No requests yet",
    emptyUsers: "No users yet (they appear after export or a premium request)",
    setPlan: "Set plan by login",
    loginPlaceholder: "github-username",
    free: "Free",
    premium: "Premium",
    pro: "Pro",
    admin: "Admin",
    unlimited: "Unlimited",
    reject: "Reject",
    refresh: "Refresh",
    status: "Status",
    plan: "Plan",
    message: "Message",
    created: "Created",
    weekly: "This week",
    pendingRequest: "Pending request",
    saveFailed: "Update failed",
    convexMissing: "Convex is not configured (VITE_CONVEX_URL).",
  },
  zh: {
    title: "导出管理",
    back: "返回编辑器",
    denied: "无权访问",
    deniedHint: "请使用管理员 GitHub 账号登录后继续。",
    signedInAs: "当前登录",
    notSignedIn: "未登录",
    loading: "加载中…",
    requests: "高级额度申请",
    users: "全部用户",
    searchUsers: "搜索用户",
    searchPlaceholder: "按 GitHub 用户名筛选…",
    noSearchMatches: "没有匹配的用户",
    empty: "暂无申请",
    emptyUsers: "暂无用户（导出或申请高级额度后会出现）",
    setPlan: "按用户名设置方案",
    loginPlaceholder: "github-用户名",
    free: "免费",
    premium: "高级",
    pro: "专业",
    admin: "管理员",
    unlimited: "无限制",
    reject: "拒绝",
    refresh: "刷新",
    status: "状态",
    plan: "方案",
    message: "留言",
    created: "时间",
    weekly: "本周",
    pendingRequest: "待处理申请",
    saveFailed: "更新失败",
    convexMissing: "未配置 Convex（VITE_CONVEX_URL）。",
  },
};

const PLAN_OPTIONS = ["free", "premium", "pro", "admin"] as const;

function planLabel(
  plan: (typeof PLAN_OPTIONS)[number],
  t: (typeof copy)["en"],
): string {
  if (plan === "free") return t.free;
  if (plan === "premium") return t.premium;
  if (plan === "pro") return t.pro;
  return t.admin;
}

export function AdminExports() {
  const language = useLanguage();
  const t = copy[language];
  const [authLogin, setAuthLogin] = useState<string | null>(
    () => getAuthStatus().login ?? null,
  );
  const isAdmin = isAdminLogin(authLogin);

  const [requests, setRequests] = useState<PremiumRequestRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualLogin, setManualLogin] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredUsers = users.filter((user) => {
    const q = userQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return true;
    return (
      user.githubLogin.toLowerCase().includes(q) ||
      user.githubId.toLowerCase().includes(q) ||
      user.plan.toLowerCase().includes(q)
    );
  });

  const syncAuth = useCallback(() => {
    setAuthLogin(getAuthStatus().login ?? null);
  }, []);

  const load = useCallback(async () => {
    syncAuth();
    const login = getAuthStatus().login;
    if (!isAdminLogin(login) || !convexConfigured) return;
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [requestResult, usersResult] = await Promise.all([
        fetchPremiumRequests(token),
        fetchAdminUsers(token),
      ]);
      if (!requestResult.ok) {
        setError(requestResult.error ?? t.denied);
        setRequests([]);
      } else {
        setRequests(requestResult.requests);
      }
      if (!usersResult.ok) {
        setError(usersResult.error ?? t.denied);
        setUsers([]);
      } else {
        setUsers(usersResult.users);
      }
    } catch {
      setError(t.saveFailed);
    } finally {
      setLoading(false);
    }
  }, [syncAuth, t.denied, t.saveFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const withToken = async (
    fn: (token: string) => Promise<{ ok: boolean; error: string | null }>,
  ) => {
    const token = getAccessToken();
    if (!token) {
      setError(t.denied);
      return;
    }
    const result = await fn(token);
    if (!result.ok) {
      setError(result.error ?? t.saveFailed);
    } else {
      setError(null);
      await load();
    }
  };

  if (!convexConfigured) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">{t.convexMissing}</p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          {t.back}
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-lg font-semibold">{t.denied}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.deniedHint}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {authLogin ? `${t.signedInAs} @${authLogin}` : t.notSignedIn}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm underline"
          >
            {t.refresh}
          </button>
          <Link to="/" className="text-sm underline">
            {t.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{t.title}</h1>
          <p className="text-xs text-muted-foreground">
            {t.signedInAs} @{ADMIN_LOGIN}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
          >
            {t.refresh}
          </button>
          <Link
            to="/"
            className="glass-toolbar-action rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold"
          >
            {t.back}
          </Link>
        </div>
      </div>

      <section className="glass-panel rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t.setPlan}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={manualLogin}
            onChange={(e) => setManualLogin(e.target.value)}
            placeholder={t.loginPlaceholder}
            className="min-w-[10rem] flex-1 rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {PLAN_OPTIONS.map((plan) => (
            <button
              key={plan}
              type="button"
              disabled={!manualLogin.trim() || busyId === `manual-${plan}`}
              className="glass-toolbar-action rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={() => {
                setBusyId(`manual-${plan}`);
                void withToken((token) =>
                  adminSetPlan(token, manualLogin.trim(), plan),
                ).finally(() => setBusyId(null));
              }}
            >
              {planLabel(plan, t)}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-panel rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t.users}
            {users.length > 0 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                ({filteredUsers.length}
                {userQuery.trim() ? ` / ${users.length}` : ""})
              </span>
            ) : null}
          </h2>
          <label className="sr-only" htmlFor="admin-user-search">
            {t.searchUsers}
          </label>
          <input
            id="admin-user-search"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full max-w-xs rounded-md border border-white/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          />
        </div>
        {loading ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.loading}</p>
        ) : users.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.emptyUsers}</p>
        ) : filteredUsers.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.noSearchMatches}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {filteredUsers.map((user) => (
              <li
                key={user._id}
                className="rounded-lg border border-white/10 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">@{user.githubLogin}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t.plan}: {user.plan} · {t.weekly}:{" "}
                      {user.plan === "admin"
                        ? `${user.weeklyUsed} (${t.unlimited})`
                        : `${user.weeklyUsed}/${user.weeklyLimit}`}
                      {user.pendingPremiumRequest
                        ? ` · ${t.pendingRequest}`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.created}: {new Date(user.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAN_OPTIONS.map((plan) => (
                      <button
                        key={plan}
                        type="button"
                        disabled={busyId === user._id || user.plan === plan}
                        className={
                          user.plan === plan
                            ? "glass-primary rounded-md px-2.5 py-1 text-[11px] font-semibold opacity-80"
                            : "glass-toolbar-action rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                        }
                        onClick={() => {
                          setBusyId(user._id);
                          void withToken((token) =>
                            adminSetPlan(token, user.githubLogin, plan),
                          ).finally(() => setBusyId(null));
                        }}
                      >
                        {planLabel(plan, t)}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t.requests}</h2>
        {loading ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.loading}</p>
        ) : requests.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {requests.map((row) => (
              <li
                key={row._id}
                className="rounded-lg border border-white/10 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">@{row.githubLogin}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t.status}: {row.status} · {t.plan}: {row.plan}
                    </p>
                    {row.message ? (
                      <p className="mt-1 text-xs">
                        {t.message}: {row.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.created}: {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {row.status === "pending" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(["premium", "pro", "admin"] as const).map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          disabled={busyId === row._id}
                          className="glass-primary rounded-md px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                          onClick={() => {
                            setBusyId(row._id);
                            void withToken((token) =>
                              adminSetPlan(token, row.githubLogin, plan),
                            ).finally(() => setBusyId(null));
                          }}
                        >
                          {planLabel(plan, t)}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busyId === row._id}
                        className="glass-toolbar-action rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                        onClick={() => {
                          setBusyId(row._id);
                          void withToken((token) =>
                            adminRejectRequest(token, row._id),
                          ).finally(() => setBusyId(null));
                        }}
                      >
                        {t.reject}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
