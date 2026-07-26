"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { Company, UserRole } from "@/lib/types";
import Modal from "@/components/Modal";

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Session = {
  role: UserRole;
};

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "", plan: "growth", billingCycle: "monthly" });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ company: Company; action: "inactive" | "active" } | null>(null);

  async function loadCompanies() {
    setIsLoading(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await sessionResponse.json();
      setSession(sessionData.session ?? null);
      const params = new URLSearchParams({ page: String(page), pageSize: "10" });
      if (query) params.set("search", query);
      if (planFilter !== "all") params.set("plan", planFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/companies?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not load companies.");
      setCompanies(data.companies ?? []);
      setPageInfo(data.pageInfo ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load companies.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCompanies(), 200);
    return () => window.clearTimeout(timer);
  }, [query, planFilter, statusFilter, page]);

  const stats = useMemo(() => {
    const active = companies.filter((company) => company.status === "active").length;
    const suspended = companies.length - active;
    return [
      { label: "Visible companies", value: pageInfo?.total ?? companies.length },
      { label: "Active", value: active },
      { label: "Suspended", value: suspended },
      { label: "Conversations", value: companies.reduce((sum, company) => sum + (company.conversationCount ?? 0), 0) },
    ];
  }, [companies, pageInfo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not create company.");
      setForm((current) => ({ ...current, name: "" }));
      setIsCreateOpen(false);
      await loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create company.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCompanyStatus() {
    if (!confirm) return;
    const response = await fetch("/api/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: confirm.company.id,
        status: confirm.action,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not update company.");
    }
    setConfirm(null);
    await loadCompanies();
  }

  if (session && session.role !== "super_admin") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Building2 className="mx-auto mb-3 text-slate-300" size={30} />
          <h1 className="text-[20px] font-semibold text-slate-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Platform company management is available only to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">Companies</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            Manage customer workspaces, plans, status changes, integrations, and usage from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 sm:w-auto"
        >
          <Plus size={16} />
          Create company
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[12px] uppercase tracking-[0.06em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-[26px] font-semibold text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(220px,1fr)_170px_170px]">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search companies" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" />
            </label>
            <select value={planFilter} onChange={(event) => { setPlanFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All plans</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Suspended</option>
            </select>
          </div>

          {error && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-slate-500">
              <Loader2 size={22} className="mr-2 animate-spin text-cyan-600" />
              Loading companies
            </div>
          ) : companies.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No companies match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-white text-[12px] uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Primary admin</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium">Integrations</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-[12px] font-semibold text-cyan-700">{company.name.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <p className="font-medium text-slate-900">{company.name}</p>
                            <p className="max-w-[220px] truncate text-[12px] text-slate-500">{company.website ?? company.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{company.primaryAdmin ?? "Not assigned"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[12px] font-medium text-cyan-700">
                          <CreditCard size={13} />
                          {company.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{company.userCount ?? 0} users · {company.botCount ?? 0} bots · {company.conversationCount ?? 0} conversations</td>
                      <td className="px-4 py-3 text-slate-600">{company.integrationStatus}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(company.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${company.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{company.status === "active" ? "active" : "suspended"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => router.push(`/companies/${company.id}`)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
                            View
                          </button>
                          <button type="button" onClick={() => setConfirm({ company, action: company.status === "active" ? "inactive" : "active" })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Company actions">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>
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

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create company"
        description="Create a customer workspace. Super Admins can see every company, user, and bot in the platform."
      >
        <form onSubmit={submit} className="space-y-3">
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Company name" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" required />
          <select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20">
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Create company
            </button>
          </div>
        </form>
      </Modal>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start gap-3 border-b border-slate-100 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-950">{confirm.action === "inactive" ? "Suspend" : "Reactivate"} {confirm.company.name}?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">This changes access for the selected company.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700">Cancel</button>
              <button onClick={updateCompanyStatus} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
