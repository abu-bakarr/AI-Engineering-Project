"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { AppUser, Company, UserRole } from "@/lib/types";
import Modal from "@/components/Modal";

type Session = {
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
};

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type GeneratedCredentials = {
  username: string;
  temporaryPassword: string;
  inviteUrl: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

function roleLabel(role: string) {
  return role.replace("_", " ");
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "company_user" as "company_admin" | "company_user",
    companyId: "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<AppUser | null>(null);
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [copiedField, setCopiedField] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
      });
      if (query) params.set("search", query);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (companyFilter) params.set("companyId", companyFilter);

      const [sessionResponse, usersResponse] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch(`/api/users?${params}`, { cache: "no-store" }),
      ]);
      const sessionData = await sessionResponse.json();
      const usersData = await usersResponse.json();
      setSession(sessionData.session ?? null);
      if (!usersResponse.ok) throw new Error(usersData?.error ?? "Could not load users.");
      setUsers(usersData.users ?? []);
      setPageInfo(usersData.pageInfo ?? null);
      if (sessionData.session?.role === "super_admin") {
        const companiesResponse = await fetch("/api/companies?pageSize=100", {
          cache: "no-store",
        });
        const companiesData = await companiesResponse.json();
        setCompanies(companiesData.companies ?? []);
        setForm((current) => ({
          ...current,
          companyId: current.companyId || companiesData.companies?.[0]?.id || "",
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [query, roleFilter, statusFilter, companyFilter, page]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not create user.");
      setForm((current) => ({ ...current, name: "", email: "" }));
      setIsCreateOpen(false);
      setCredentials(data?.credentials ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(user: AppUser) {
    const status = user.status === "active" ? "disabled" : "active";
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not update user.");
      return;
    }
    setConfirmUser(null);
    await load();
  }

  async function resendInvitation(user: AppUser) {
    setError("");
    const response = await fetch(`/api/users/${user.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resend_invitation" }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not resend invitation.");
      return;
    }
    const data = await response.json().catch(() => null);
    setCredentials(data?.credentials ?? null);
    setConfirmUser(null);
    await load();
  }

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value).catch(() => null);
    setCopiedField(label);
    window.setTimeout(() => setCopiedField(""), 1800);
  }

  async function copyAllCredentials() {
    if (!credentials) return;
    await copyValue(
      "all",
      [
        `Username: ${credentials.username}`,
        `Temporary password: ${credentials.temporaryPassword}`,
        `Setup link: ${credentials.inviteUrl}`,
      ].join("\n"),
    );
  }

  async function removeUserAccount(user: AppUser) {
    setError("");
    const response = await fetch(`/api/users/${user.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not remove user.");
      return;
    }
    setConfirmUser(null);
    await load();
  }

  if (session?.role === "company_user") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 text-slate-300" size={30} />
          <h1 className="text-[20px] font-semibold text-slate-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            User administration is available only to Company Admins and Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">Users</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            Manage administrators and support staff for {session?.role === "super_admin" ? "the full platform" : session?.companyName ?? "your company"}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            {pageInfo?.total ?? users.length} users
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 sm:w-auto"
          >
            <Plus size={16} />
            Add user
          </button>
        </div>
      </div>

      <div className="mb-5">
        <section className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(220px,1fr)_170px_170px_170px]">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search users" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" />
            </label>
            <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All roles</option>
              <option value="company_admin">Company admin</option>
              <option value="company_user">Company user</option>
              {session?.role === "super_admin" && <option value="super_admin">Super admin</option>}
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            {session?.role === "super_admin" ? (
              <select value={companyFilter} onChange={(event) => { setCompanyFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">All companies</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">{session?.companyName ?? "Company"}</div>
            )}
          </div>

          {error && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-slate-500">
              <Loader2 size={22} className="mr-2 animate-spin text-cyan-600" />
              Loading users
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center">
              <UserCog className="mx-auto mb-3 text-slate-300" size={28} />
              <h2 className="text-[15px] font-semibold text-slate-950">No users found</h2>
              <p className="mt-1 text-sm text-slate-500">Adjust your filters or add a user.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-white text-[12px] uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last active</th>
                    <th className="px-4 py-3 font-medium">Date added</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-[12px] font-semibold text-cyan-700">{initials(user.name)}</div>
                          <div>
                            <p className="font-medium text-slate-900">{user.name}</p>
                            <p className="text-[12px] text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.companyName ?? "Platform"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[12px] font-medium capitalize text-cyan-700">
                          <ShieldCheck size={13} />
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${user.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{user.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {user.role === "super_admin" ? (
                          <span className="text-[12px] text-slate-400">Locked</span>
                        ) : (
                          <button type="button" onClick={() => setConfirmUser(user)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Open actions">
                            <MoreHorizontal size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>Page {pageInfo?.page ?? page} of {pageInfo?.totalPages ?? 1}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">Previous</button>
              <button disabled={pageInfo ? page >= pageInfo.totalPages : true} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add user"
        description="Invite a company-scoped administrator or support user. Super Admin role assignment is not allowed here."
      >
        <form onSubmit={submit} className="space-y-3">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Full name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" required />
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="email@company.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" required />
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "company_admin" | "company_user" })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
            <option value="company_user">Company user</option>
            <option value="company_admin">Company admin</option>
          </select>
          {session?.role === "super_admin" && (
            <select value={form.companyId} onChange={(event) => setForm({ ...form, companyId: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" required>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
              Add user
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        onClose={() => setCredentials(null)}
        title="User credentials ready"
        description="These credentials are shown once for admins. The same details were sent by email."
      >
        {credentials && (
          <div className="space-y-4">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3 text-[13px] leading-5 text-cyan-900">
              The user can either sign in with the username and temporary password,
              then change the password in the first-login modal, or use the setup link directly.
            </div>
            {[
              ["username", "Username", credentials.username],
              ["password", "Temporary password", credentials.temporaryPassword],
              ["link", "Setup link", credentials.inviteUrl],
            ].map(([key, label, value]) => (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  {label}
                </p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-white px-2 py-2 text-[13px] text-slate-800 ring-1 ring-slate-200">
                    {value}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyValue(key, value)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    title={`Copy ${label}`}
                  >
                    {copiedField === key ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={copyAllCredentials}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiedField === "all" ? <Check size={15} /> : <Copy size={15} />}
                Copy all
              </button>
              <button
                type="button"
                onClick={() => setCredentials(null)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-950">Manage {confirmUser.name}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Choose an action for this user. Access controls still apply to the selected company.
                </p>
              </div>
            </div>
            <div className="space-y-2 p-4">
              <button
                onClick={() => resendInvitation(confirmUser)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-cyan-50"
              >
                <span>
                  <span className="block font-semibold text-slate-900">Resend invitation</span>
                  <span className="text-[12px] text-slate-500">Send a new temporary password and setup link.</span>
                </span>
                <MailPlus size={16} className="text-cyan-700" />
              </button>
              <button
                onClick={() => updateStatus(confirmUser)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <span>
                  <span className="block font-semibold text-slate-900">
                    {confirmUser.status === "active" ? "Disable user" : "Reactivate user"}
                  </span>
                  <span className="text-[12px] text-slate-500">Change whether this user can access the workspace.</span>
                </span>
                <ShieldCheck size={16} className="text-slate-500" />
              </button>
              <button
                onClick={() => removeUserAccount(confirmUser)}
                className="flex w-full items-center justify-between rounded-lg border border-red-200 px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50"
              >
                <span>
                  <span className="block font-semibold">Remove user</span>
                  <span className="text-[12px] text-red-500">Delete this user from the workspace.</span>
                </span>
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex justify-end border-t border-slate-100 p-4">
              <button onClick={() => setConfirmUser(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
