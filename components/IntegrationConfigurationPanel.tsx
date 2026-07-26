"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  MessageCircle,
  PhoneCall,
  Save,
  ShieldCheck,
} from "lucide-react";
import type {
  ChannelIntegration,
  Company,
  IntegrationChannel,
  UserRole,
} from "@/lib/types";

type Session = {
  role: UserRole;
  companyId: string | null;
  companyName: string | null;
};

type IntegrationResponse = {
  company?: {
    id: string;
    name: string;
    plan: string;
    whatsappEnabled?: boolean;
    facebookEnabled?: boolean;
  };
  canConfigure?: boolean;
  integrations?: ChannelIntegration[];
  error?: string;
};

const channels: Array<{
  id: IntegrationChannel;
  label: string;
  tokenLabel: string;
  tokenEnv: string;
  icon: typeof PhoneCall;
}> = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    tokenLabel: "Access token",
    tokenEnv: "WHATSAPP_ACCESS_TOKEN",
    icon: PhoneCall,
  },
  {
    id: "facebook",
    label: "Facebook Messenger",
    tokenLabel: "Page access token",
    tokenEnv: "FACEBOOK_PAGE_ACCESS_TOKEN",
    icon: MessageCircle,
  },
];

const statusOptions = [
  "pending",
  "connected",
  "disconnected",
  "error",
  "token_expired",
  "reauthorization_required",
];

function envNames(channel: IntegrationChannel) {
  if (channel === "whatsapp") {
    return {
      appId: "WHATSAPP_APP_ID",
      appSecret: "WHATSAPP_APP_SECRET",
      verifyToken: "WHATSAPP_VERIFY_TOKEN",
    };
  }
  return {
    appId: "FACEBOOK_APP_ID",
    appSecret: "FACEBOOK_APP_SECRET",
    verifyToken: "FACEBOOK_VERIFY_TOKEN",
  };
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function IntegrationConfigurationPanel({
  title = "Channel integrations",
  description = "Connect company-owned Meta channels without exposing tokens in the browser after save.",
  compact = false,
  selectedCompanyId: controlledCompanyId,
  channelAvailability,
  lockCompanySelection = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  selectedCompanyId?: string;
  channelAvailability?: Partial<Record<IntegrationChannel, boolean>>;
  lockCompanySelection?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedChannel, setSelectedChannel] =
    useState<IntegrationChannel>("whatsapp");
  const [integrations, setIntegrations] = useState<ChannelIntegration[]>([]);
  const [companyPlan, setCompanyPlan] = useState("");
  const [companyChannelAvailability, setCompanyChannelAvailability] = useState<
    Partial<Record<IntegrationChannel, boolean>>
  >({});
  const [canConfigure, setCanConfigure] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    externalAccountId: "",
    appId: "",
    appSecret: "",
    verifyToken: "",
    accessToken: "",
    status: "pending",
    tokenExpiresAt: "",
  });

  const isSuperAdmin = session?.role === "super_admin";
  const selectedIntegration = useMemo(
    () => integrations.find((item) => item.channel === selectedChannel),
    [integrations, selectedChannel],
  );
  const selectedChannelMeta = channels.find((item) => item.id === selectedChannel) ?? channels[0];
  const selectedEnv = envNames(selectedChannel);
  const effectiveChannelAvailability = channelAvailability ?? companyChannelAvailability;
  const selectedChannelEnabled = effectiveChannelAvailability?.[selectedChannel] ?? true;
  const canSaveSelectedChannel = canConfigure && selectedChannelEnabled;
  const formDisabled = !canSaveSelectedChannel || isSaving;

  async function loadSessionAndCompanies() {
    setIsLoading(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await sessionResponse.json();
      const nextSession = sessionData.session ?? null;
      setSession(nextSession);

      if (nextSession?.role === "super_admin") {
        if (controlledCompanyId) {
          setSelectedCompanyId(controlledCompanyId);
        } else {
          const companiesResponse = await fetch("/api/companies?pageSize=100", {
            cache: "no-store",
          });
          const companiesData = await companiesResponse.json();
          const nextCompanies = companiesData.companies ?? [];
          setCompanies(nextCompanies);
          setSelectedCompanyId((current) => current || nextCompanies[0]?.id || "");
        }
      } else if (nextSession?.companyId) {
        setSelectedCompanyId(nextSession.companyId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load integration setup.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIntegrations(companyId: string) {
    if (!companyId) return;
    setError("");
    try {
      const params = new URLSearchParams();
      if (isSuperAdmin) params.set("companyId", companyId);
      const response = await fetch(`/api/integrations?${params}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as IntegrationResponse;
      if (!response.ok) throw new Error(data.error ?? "Could not load integrations.");
      setIntegrations(data.integrations ?? []);
      setCompanyPlan(data.company?.plan ?? "");
      setCompanyChannelAvailability({
        whatsapp: data.company?.whatsappEnabled ?? true,
        facebook: data.company?.facebookEnabled ?? true,
      });
      setCanConfigure(Boolean(data.canConfigure));
    } catch (err) {
      setIntegrations([]);
      setCompanyChannelAvailability({});
      setCanConfigure(false);
      setError(err instanceof Error ? err.message : "Could not load integrations.");
    }
  }

  useEffect(() => {
    void loadSessionAndCompanies();
  }, []);

  useEffect(() => {
    if (controlledCompanyId) {
      setSelectedCompanyId(controlledCompanyId);
    }
  }, [controlledCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) void loadIntegrations(selectedCompanyId);
  }, [selectedCompanyId, isSuperAdmin]);

  useEffect(() => {
    setForm({
      displayName: selectedIntegration?.displayName ?? "",
      externalAccountId: selectedIntegration?.externalAccountId ?? "",
      appId: "",
      appSecret: "",
      verifyToken: "",
      accessToken: "",
      status: selectedIntegration?.status ?? "pending",
      tokenExpiresAt: toDateTimeLocal(selectedIntegration?.tokenExpiresAt),
    });
    setSaved(false);
  }, [selectedIntegration?.id, selectedChannel]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId || !canSaveSelectedChannel) return;
    setIsSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: isSuperAdmin ? selectedCompanyId : undefined,
          channel: selectedChannel,
          displayName: form.displayName,
          externalAccountId: form.externalAccountId,
          appId: form.appId,
          appSecret: form.appSecret,
          verifyToken: form.verifyToken,
          accessToken: form.accessToken,
          status: form.status,
          tokenExpiresAt: form.tokenExpiresAt
            ? new Date(form.tokenExpiresAt).toISOString()
            : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save integration.");
      await loadIntegrations(selectedCompanyId);
      setForm((current) => ({
        ...current,
        appId: "",
        appSecret: "",
        verifyToken: "",
        accessToken: "",
      }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save integration.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        <Loader2 className="mr-2 inline animate-spin text-cyan-600" size={16} />
        Loading integration setup
      </div>
    );
  }

  if (!session || (session.role !== "super_admin" && session.role !== "company_admin")) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <KeyRound size={18} className="text-cyan-700" />
            <h2 className="text-[16px] font-semibold text-slate-950">{title}</h2>
          </div>
          <p className="max-w-3xl text-[13px] leading-5 text-slate-500">
            {description}
          </p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium capitalize text-slate-600">
          {companyPlan || "plan pending"}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? "" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
        <div className="space-y-3">
          {isSuperAdmin && !lockCompanySelection && !controlledCompanyId && (
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                Company
              </span>
              <select
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-2">
            {channels.map(({ id, label, icon: Icon }) => {
              const integration = integrations.find((item) => item.channel === id);
              const channelEnabled = effectiveChannelAvailability?.[id] ?? true;
              const active = selectedChannel === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedChannel(id)}
                  className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                    !channelEnabled
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : active
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Icon size={16} className="text-cyan-700" />
                      {label}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium capitalize text-slate-600 ring-1 ring-slate-200">
                      {channelEnabled
                        ? integration?.status?.replaceAll("_", " ") ?? "not set"
                        : "disabled"}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-500">
                    {!channelEnabled
                      ? "Disabled by the platform admin"
                      : integration?.hasCredentials
                      ? `Saved fields: ${integration.credentialFields.join(", ")}`
                      : "No credentials saved yet"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          {!selectedChannelEnabled && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
              This channel is turned off for this company. Ask a Super Admin to enable it before configuring credentials.
            </div>
          )}

          {selectedChannelEnabled && !canConfigure && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800">
              WhatsApp and Facebook Messenger setup is available on Growth and Enterprise plans.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                Display name
              </span>
              <input
                value={form.displayName}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder={`${selectedChannelMeta.label} Business`}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                External account ID
              </span>
              <input
                value={form.externalAccountId}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    externalAccountId: event.target.value,
                  }))
                }
                placeholder="Phone number ID or page ID"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                App ID <span className="text-slate-400">({selectedEnv.appId})</span>
              </span>
              <input
                value={form.appId}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, appId: event.target.value }))
                }
                placeholder={selectedIntegration?.maskedCredentials.appId ?? "Leave blank to keep saved value"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                App secret <span className="text-slate-400">({selectedEnv.appSecret})</span>
              </span>
              <input
                type="password"
                value={form.appSecret}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, appSecret: event.target.value }))
                }
                placeholder={selectedIntegration?.maskedCredentials.appSecret ?? "Leave blank to keep saved value"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                Verify token <span className="text-slate-400">({selectedEnv.verifyToken})</span>
              </span>
              <input
                type="password"
                value={form.verifyToken}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, verifyToken: event.target.value }))
                }
                placeholder={selectedIntegration?.maskedCredentials.verifyToken ?? "Leave blank to keep saved value"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                {selectedChannelMeta.tokenLabel}{" "}
                <span className="text-slate-400">({selectedChannelMeta.tokenEnv})</span>
              </span>
              <input
                type="password"
                value={form.accessToken}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accessToken: event.target.value }))
                }
                placeholder={selectedIntegration?.maskedCredentials.accessToken ?? "Leave blank to keep saved value"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                Status
              </span>
              <select
                value={form.status}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-slate-600">
                Token expires
              </span>
              <input
                type="datetime-local"
                value={form.tokenExpiresAt}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tokenExpiresAt: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-slate-50 px-3 py-3 text-[12px] leading-5 text-slate-600 md:flex-row md:items-center md:justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-cyan-700" />
              Saved secrets are encrypted server-side and returned only as masked field names.
            </span>
            {selectedIntegration?.hasCredentials && (
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={14} />
                Credentials saved
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-emerald-700">Saved</span>}
            <button
              type="submit"
              disabled={!canSaveSelectedChannel || isSaving || !selectedCompanyId}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save integration
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
