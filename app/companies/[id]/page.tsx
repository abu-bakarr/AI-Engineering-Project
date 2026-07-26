"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Loader2,
  MessageCircle,
  PhoneCall,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Company, UserRole } from "@/lib/types";

type Session = {
  role: UserRole;
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({
    plan: "starter",
    whatsappEnabled: false,
    facebookEnabled: false,
    liveChatEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const [sessionResponse, companyResponse] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch(`/api/companies/${params.id}`, { cache: "no-store" }),
      ]);
      const sessionData = await sessionResponse.json();
      const companyData = await companyResponse.json();
      setSession(sessionData.session ?? null);
      if (!companyResponse.ok) {
        throw new Error(companyData?.error ?? "Could not load company.");
      }
      setCompany(companyData.company);
      setForm({
        plan: companyData.company.plan,
        whatsappEnabled: Boolean(companyData.company.whatsappEnabled),
        facebookEnabled: Boolean(companyData.company.facebookEnabled),
        liveChatEnabled: Boolean(companyData.company.liveChatEnabled),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load company.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function saveConfiguration() {
    if (!company) return;
    setIsSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          plan: form.plan,
          whatsappEnabled: form.whatsappEnabled,
          facebookEnabled: form.facebookEnabled,
          liveChatEnabled: form.liveChatEnabled,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save configuration.");
      setCompany(data.company);
      setForm({
        plan: data.company.plan,
        whatsappEnabled: Boolean(data.company.whatsappEnabled),
        facebookEnabled: Boolean(data.company.facebookEnabled),
        liveChatEnabled: Boolean(data.company.liveChatEnabled),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save configuration.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 animate-spin text-cyan-600" size={18} />
        Loading company
      </div>
    );
  }

  if (session?.role !== "super_admin") {
    return (
      <div className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 text-slate-300" size={30} />
          <h1 className="text-[20px] font-semibold text-slate-950">Access denied</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Company detail and channel setup are available only to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-slate-950">Company not found</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "The company could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const messagingAllowed = form.plan === "growth" || form.plan === "enterprise";

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <button
        type="button"
        onClick={() => router.push("/companies")}
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={15} />
        Back to companies
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-slate-950">{company.name}</h1>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Review company details, usage, plan status, and channel setup.
          </p>
        </div>
        <span className="w-fit rounded-full bg-cyan-50 px-3 py-1.5 text-[12px] font-medium text-cyan-700 ring-1 ring-cyan-200">
          {company.status}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          { label: "Users", value: company.userCount ?? 0, icon: Users },
          { label: "Bots", value: company.botCount ?? 0, icon: Building2 },
          { label: "Conversations", value: company.conversationCount ?? 0, icon: MessageCircle },
          { label: "Integrations", value: company.integrationStatus ?? "Not configured", icon: PhoneCall },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Icon size={17} className="mb-3 text-cyan-700" />
            <p className="text-[12px] uppercase tracking-[0.06em] text-slate-500">{label}</p>
            <p className="mt-1 text-[18px] font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Building2 size={18} className="text-cyan-700" />
            <h2 className="text-[16px] font-semibold text-slate-950">Company details</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Company", company.name],
              ["Website", company.website ?? "Not set"],
              ["Primary admin", company.primaryAdmin ?? "Not assigned"],
              ["Support email", company.supportEmail ?? "Not set"],
              ["Timezone", company.timezone],
              ["Created", new Date(company.createdAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-[12px] uppercase tracking-[0.06em] text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard size={18} className="text-cyan-700" />
            <h2 className="text-[16px] font-semibold text-slate-950">Plan and channel setup</h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-slate-600">Subscription plan</span>
              <select
                value={form.plan}
                onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>

            {[
              {
                key: "whatsappEnabled",
                title: "WhatsApp",
                copy: "Allow this company to connect WhatsApp Business messaging.",
              },
              {
                key: "facebookEnabled",
                title: "Facebook Messenger",
                copy: "Allow this company to connect a Facebook page inbox.",
              },
              {
                key: "liveChatEnabled",
                title: "Live-agent takeover",
                copy: "Allow staff to join conversations and pause AI replies.",
              },
            ].map((item) => (
              <label key={item.key} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-1 block text-[12px] leading-5 text-slate-500">{item.copy}</span>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(form[item.key as keyof typeof form])}
                  disabled={!messagingAllowed}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [item.key]: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
                />
              </label>
            ))}

            {!messagingAllowed && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-800">
                WhatsApp, Facebook Messenger, and live takeover require Growth or Enterprise.
              </p>
            )}

            <div className="rounded-lg bg-slate-50 p-3 text-[12px] leading-5 text-slate-500">
              Store Meta app secrets in environment variables or a secret manager. Do not paste
              access tokens into client-side code.
            </div>

            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-emerald-700">Saved</span>}
              <button
                type="button"
                onClick={saveConfiguration}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save configuration
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
