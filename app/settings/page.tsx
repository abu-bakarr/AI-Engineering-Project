"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  LockKeyhole,
  MessageCircle,
  PhoneCall,
  PlugZap,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import IntegrationConfigurationPanel from "@/components/IntegrationConfigurationPanel";
import { canJoinLiveChat, canUseChannel, normalizedPlan } from "@/lib/plans";
import { Company, UserRole } from "@/lib/types";

type Session = {
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
};

type ChannelKey = "whatsappEnabled" | "facebookEnabled" | "liveChatEnabled";

const profileFields = [
  ["name", "Company name"],
  ["website", "Website"],
  ["industry", "Industry"],
  ["supportEmail", "Contact email"],
  ["phone", "Phone"],
  ["country", "Country"],
  ["timezone", "Time zone"],
  ["defaultLanguage", "Default language"],
] as const;

const settingSections = [
  {
    title: "Chat configuration",
    icon: MessageCircle,
    items: ["Widget appearance", "Welcome message", "Offline message", "Business hours", "Auto-close rules"],
  },
  {
    title: "AI controls",
    icon: Bot,
    items: ["Response tone", "Confidence threshold", "Escalation threshold", "Handoff rules", "Citation requirements"],
  },
  {
    title: "Notifications",
    icon: Bell,
    items: ["Email alerts", "Assignment alerts", "Escalation alerts", "Integration errors", "SLA alerts"],
  },
  {
    title: "Security",
    icon: LockKeyhole,
    items: ["Session policy", "MFA settings", "Allowed domains", "Retention rules", "Audit access"],
  },
] as const;

function channelAllowed(plan: string, key: ChannelKey) {
  if (key === "whatsappEnabled") return canUseChannel(plan, "whatsapp");
  if (key === "facebookEnabled") return canUseChannel(plan, "facebook");
  return canJoinLiveChat(plan);
}

export default function SettingsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [channelForm, setChannelForm] = useState<Record<ChannelKey, boolean>>({
    whatsappEnabled: false,
    facebookEnabled: false,
    liveChatEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await sessionResponse.json();
      const nextSession = sessionData.session ?? null;
      setSession(nextSession);

      if (nextSession?.role !== "company_admin" && nextSession?.role !== "super_admin") {
        return;
      }

      const companyResponse = await fetch(
        `/api/companies?pageSize=${nextSession.role === "super_admin" ? "100" : "1"}`,
        { cache: "no-store" },
      );
      const companyData = await companyResponse.json();
      const nextCompanies = companyData.companies ?? [];
      setCompanies(nextCompanies);
      const nextCompany =
        nextCompanies.find((item: Company) => item.id === selectedCompanyId) ??
        nextCompanies[0] ??
        null;
      if (nextCompany) {
        setSelectedCompanyId(nextCompany.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const nextCompany =
      companies.find((item) => item.id === selectedCompanyId) ?? null;
    setCompany(nextCompany);
    if (nextCompany) {
      setChannelForm({
        whatsappEnabled: Boolean(nextCompany.whatsappEnabled),
        facebookEnabled: Boolean(nextCompany.facebookEnabled),
        liveChatEnabled: Boolean(nextCompany.liveChatEnabled),
      });
      setSaved("");
      setError("");
    }
  }, [companies, selectedCompanyId]);

  const plan = normalizedPlan(company?.plan);
  const canAccessSettings = session?.role === "company_admin" || session?.role === "super_admin";
  const isSuperAdmin = session?.role === "super_admin";
  const channelRows = useMemo(
    () => [
      {
        key: "whatsappEnabled" as const,
        label: "WhatsApp",
        copy: "Connect WhatsApp Business conversations to the shared inbox.",
        icon: PhoneCall,
      },
      {
        key: "facebookEnabled" as const,
        label: "Facebook Messenger",
        copy: "Connect Facebook page messages to the shared inbox.",
        icon: MessageCircle,
      },
      {
        key: "liveChatEnabled" as const,
        label: "Live-agent takeover",
        copy: "Allow staff to join conversations and pause AI responses.",
        icon: Headphones,
      },
    ],
    [],
  );

  async function saveProfile() {
    if (!company || !canAccessSettings) return;
    setIsSavingProfile(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          name: company.name,
          website: company.website,
          industry: company.industry,
          supportEmail: company.supportEmail,
          phone: company.phone,
          country: company.country,
          timezone: company.timezone,
          defaultLanguage: company.defaultLanguage,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save profile.");
      setCompany(data.company);
      setCompanies((current) =>
        current.map((item) => (item.id === data.company.id ? data.company : item)),
      );
      setSaved("Company profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveChannels() {
    if (!company || !isSuperAdmin) return;
    setIsSavingChannels(true);
    setError("");
    setSaved("");
    try {
      const next = {
        whatsappEnabled: channelAllowed(plan, "whatsappEnabled")
          ? channelForm.whatsappEnabled
          : false,
        facebookEnabled: channelAllowed(plan, "facebookEnabled")
          ? channelForm.facebookEnabled
          : false,
        liveChatEnabled: channelAllowed(plan, "liveChatEnabled")
          ? channelForm.liveChatEnabled
          : false,
      };
      const response = await fetch("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          ...next,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save channels.");
      setCompany(data.company);
      setCompanies((current) =>
        current.map((item) => (item.id === data.company.id ? data.company : item)),
      );
      setChannelForm({
        whatsappEnabled: Boolean(data.company.whatsappEnabled),
        facebookEnabled: Boolean(data.company.facebookEnabled),
        liveChatEnabled: Boolean(data.company.liveChatEnabled),
      });
      setSaved("Plan and channel setup saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save channels.");
    } finally {
      setIsSavingChannels(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 animate-spin text-cyan-600" size={18} />
        Loading settings
      </div>
    );
  }

  if (!canAccessSettings) {
    return (
      <div className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 text-slate-300" size={34} />
          <h1 className="text-[24px] font-semibold text-slate-950">Settings are restricted</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Only Company Admins can access this page. Ask a Company Admin to update
            profile, channel, integration, security, and notification settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
                Company administration
              </p>
              <h1 className="text-[28px] font-semibold tracking-normal">Settings</h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-300">
                {isSuperAdmin
                  ? "Manage company profile, channel availability, integration setup, and operating controls."
                  : "Manage your company profile, integration setup, and operating controls."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-[12px] font-medium capitalize text-cyan-200 ring-1 ring-cyan-300/30">
                {plan} plan
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white ring-1 ring-white/15">
                {isSuperAdmin ? "Super Admin access" : "Company Admin access"}
              </span>
            </div>
          </div>
        </div>

        {(error || saved) && (
          <div className={`px-5 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {error || saved}
          </div>
        )}

        <div
          className={`grid gap-0 divide-y divide-slate-200 ${
            isSuperAdmin ? "lg:grid-cols-[minmax(0,1fr)_360px] lg:divide-x lg:divide-y-0" : ""
          }`}
        >
          <section className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-950">Company profile</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  These details appear across admin views and customer-facing support surfaces.
                </p>
              </div>
              <Building2 size={19} className="text-cyan-700" />
            </div>

            <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold uppercase tracking-[0.06em] text-cyan-800">
                  Company
                </span>
                {session?.role === "super_admin" ? (
                  <select
                    value={selectedCompanyId}
                    onChange={(event) => setSelectedCompanyId(event.target.value)}
                    className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  >
                    {companies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm font-medium text-slate-900">
                    {company?.name ?? session?.companyName ?? "Company"}
                  </div>
                )}
              </label>
              <p className="mt-2 text-[12px] leading-5 text-cyan-900/75">
                {isSuperAdmin
                  ? "The profile fields, Plan and channel setup, and integration setup are tied to this selected company."
                  : "The profile fields and integration setup are tied to your company."}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {profileFields.map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[12px] font-medium text-slate-600">{label}</span>
                  <input
                    value={String((company as unknown as Record<string, string | undefined>)?.[key] ?? "")}
                    onChange={(event) =>
                      setCompany((current) =>
                        current ? { ...current, [key]: event.target.value } : current,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={saveProfile}
                disabled={isSavingProfile}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {isSavingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save profile
              </button>
            </div>
          </section>

          {isSuperAdmin && (
          <aside className="bg-slate-50 p-5">
            <div className="mb-5 flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-cyan-700" />
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">Plan and channel setup</h2>
                <p className="text-[12px] text-slate-500">
                  {company?.name ?? "Selected company"} · unavailable features stay unchecked and disabled.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {channelRows.map(({ key, label, copy, icon: Icon }) => {
                const allowed = channelAllowed(plan, key);
                const checked = allowed ? channelForm[key] : false;
                return (
                  <label
                    key={key}
                    className={`block rounded-lg border p-3 transition-colors ${
                      allowed
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-100 opacity-75"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex min-w-0 gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${allowed ? "bg-cyan-50 text-cyan-700" : "bg-white text-slate-400"}`}>
                          <Icon size={17} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{label}</span>
                          <span className="mt-1 block text-[12px] leading-5 text-slate-500">{copy}</span>
                          {!allowed && (
                            <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                              Requires Growth or Enterprise
                            </span>
                          )}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!allowed}
                        onChange={(event) =>
                          setChannelForm((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={saveChannels}
              disabled={isSavingChannels}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSavingChannels ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Save channel setup
            </button>
          </aside>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        {[
          { label: "Website widget", value: canUseChannel(plan, "web") ? "Available" : "Blocked", icon: PlugZap },
          {
            label: "WhatsApp",
            value: !canUseChannel(plan, "whatsapp")
              ? "Plan locked"
              : company?.whatsappEnabled
                ? "Available"
                : "Disabled",
            icon: PhoneCall,
          },
          {
            label: "Facebook",
            value: !canUseChannel(plan, "facebook")
              ? "Plan locked"
              : company?.facebookEnabled
                ? "Available"
                : "Disabled",
            icon: MessageCircle,
          },
          {
            label: "Live takeover",
            value: !canJoinLiveChat(plan)
              ? "Plan locked"
              : company?.liveChatEnabled
                ? "Available"
                : "Disabled",
            icon: ShieldCheck,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Icon size={17} className="mb-3 text-cyan-700" />
            <p className="text-[12px] uppercase tracking-[0.06em] text-slate-500">{label}</p>
            <p className="mt-1 text-[16px] font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <IntegrationConfigurationPanel
            title="WhatsApp and Facebook setup"
            description="Add Meta app keys and tokens for this company. Growth and Enterprise Company Admins can configure their own channels; Starter companies stay locked."
            selectedCompanyId={selectedCompanyId}
            channelAvailability={{
              whatsapp: Boolean(company?.whatsappEnabled),
              facebook: Boolean(company?.facebookEnabled),
            }}
            lockCompanySelection
          />

          <div className="grid gap-4 md:grid-cols-2">
            {settingSections.map(({ title, icon: Icon, items }) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>
                  <Icon size={17} className="text-cyan-700" />
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">{item}</span>
                      <span className="text-[12px] text-slate-400">Configurable</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock size={16} className="text-cyan-700" />
              <h2 className="text-[15px] font-semibold text-slate-950">Governance status</h2>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ["Audit history", "Enabled"],
                ["Data retention", "365 days"],
                ["Sensitive approvals", plan === "enterprise" ? "Available" : "Enterprise"],
                ["SLA policies", plan === "enterprise" ? "Available" : "Enterprise"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
            <h2 className="text-[15px] font-semibold text-cyan-950">Access rule</h2>
            <p className="mt-2 text-[13px] leading-5 text-cyan-900/75">
              Only Company Admins can access this page. Company Users are blocked
              from changing company settings, channels, integrations, and security controls.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
