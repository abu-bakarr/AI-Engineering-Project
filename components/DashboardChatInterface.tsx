"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot as BotIcon,
  Building2,
  Database,
  FileText,
  Gauge,
  Headphones,
  LineChart,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import IntegrationConfigurationPanel from "@/components/IntegrationConfigurationPanel";
import { Bot, ChatCitation, ChatResponse, DashboardAnalytics } from "@/lib/types";

type Message = {
  role: "user" | "bot";
  text: string;
  citations?: ChatCitation[];
  latencyMs?: number;
};

const chartColors = [
  "bg-cyan-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-blue-600",
  "bg-rose-500",
  "bg-slate-700",
];

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

function humanLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function maxValue(items: Array<{ value: number }>) {
  return Math.max(1, ...items.map((item) => item.value));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: "cyan" | "emerald" | "amber" | "blue" | "slate";
}) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-[28px] font-semibold text-slate-950">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-[13px] leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function TrendChart({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: number }>;
}) {
  const peak = maxValue(items);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{description}</p>
        </div>
        <LineChart size={18} className="text-cyan-700" />
      </div>
      <div className="flex h-60 items-end gap-3 rounded-lg bg-slate-50 px-4 py-4">
        {items.map((item, index) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center">
              <div
                className={`w-full max-w-12 rounded-t-lg ${chartColors[index % chartColors.length]} transition-all duration-700`}
                style={{ height: `${Math.max(8, (item.value / peak) * 100)}%` }}
                title={`${item.value} messages`}
              />
            </div>
            <span className="truncate text-[11px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  description,
  items,
  emptyLabel = "No data yet.",
}: {
  title: string;
  description: string;
  items?: Array<{ label: string; value: number }>;
  emptyLabel?: string;
}) {
  const rows = items ?? [];
  const peak = maxValue(rows);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-[13px] text-slate-500">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((item, index) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{humanLabel(item.label)}</span>
                <span className="text-slate-500">{formatNumber(item.value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${chartColors[index % chartColors.length]} transition-all duration-700`}
                  style={{ width: `${Math.max(5, (item.value / peak) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivityCard({ analytics }: { analytics: DashboardAnalytics }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-slate-950">Recent activity</h2>
        <Activity size={18} className="text-cyan-700" />
      </div>
      <div className="space-y-3">
        {analytics.recentActivity.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            No activity has been recorded yet.
          </p>
        ) : (
          analytics.recentActivity.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[13px] font-medium text-slate-800">{item.message}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {humanLabel(item.type)} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function TopBotsCard({ analytics }: { analytics: DashboardAnalytics }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-slate-950">Top bots</h2>
        <BotIcon size={18} className="text-cyan-700" />
      </div>
      <div className="space-y-3">
        {analytics.topBots.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
            No bot usage yet.
          </p>
        ) : (
          analytics.topBots.map((bot) => (
            <div key={bot.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{bot.name}</p>
                  {bot.companyName && (
                    <p className="mt-1 truncate text-[12px] text-slate-500">{bot.companyName}</p>
                  )}
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium capitalize text-slate-600 ring-1 ring-slate-200">
                  {bot.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-500">
                <span>{formatNumber(bot.totalQueries)} queries</span>
                <span>{formatNumber(bot.conversations)} conversations</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PlatformDashboard({ analytics }: { analytics: DashboardAnalytics }) {
  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-5 py-6 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
                Platform command center
              </p>
              <h1 className="text-[30px] font-semibold tracking-normal">Super Admin Dashboard</h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-300">
                Monitor every company, bot, channel, conversation, and integration from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/companies" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-50">
                Manage companies
                <ArrowRight size={15} />
              </Link>
              <Link href="/users" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                View users
                <Users size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Companies" value={formatNumber(analytics.totalCompanies)} detail={`${formatNumber(analytics.activeCompanies)} active, ${formatNumber(analytics.suspendedCompanies)} inactive`} icon={Building2} tone="cyan" />
        <MetricCard label="Users" value={formatNumber(analytics.totalUsers)} detail={`${formatNumber(analytics.activeUsers)} active platform users`} icon={Users} tone="blue" />
        <MetricCard label="Bots" value={formatNumber(analytics.totalBots)} detail={`${formatNumber(analytics.activeBots)} active support bots`} icon={BotIcon} tone="emerald" />
        <MetricCard label="Conversations" value={formatNumber(analytics.totalConversations)} detail={`${formatNumber(analytics.openConversations)} currently open`} icon={MessageSquare} tone="amber" />
        <MetricCard label="Messages" value={formatNumber(analytics.totalMessages)} detail={`${formatNumber(analytics.totalQueries)} AI queries handled`} icon={Database} tone="slate" />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <TrendChart
          title="Message volume"
          description="Inbound and outbound messages across the full platform for the last six days."
          items={analytics.activity}
        />
        <BreakdownCard
          title="Subscription plans"
          description="Company distribution by active plan."
          items={analytics.planBreakdown}
        />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <BreakdownCard title="Company status" description="Active and inactive tenants." items={analytics.companyStatusBreakdown} />
        <BreakdownCard title="Bot status" description="Draft and active bot inventory." items={analytics.botStatusBreakdown} />
        <BreakdownCard title="Conversation status" description="Open, pending, resolved, and closed work." items={analytics.conversationStatusBreakdown} />
        <BreakdownCard title="Channel mix" description="Conversation volume by customer channel." items={analytics.channelBreakdown} />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-slate-950">Companies to watch</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Recent tenants with their current footprint.
              </p>
            </div>
            <Building2 size={18} className="text-cyan-700" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] uppercase tracking-[0.06em] text-slate-500">
                  <th className="py-3 pr-4 font-medium">Company</th>
                  <th className="py-3 pr-4 font-medium">Plan</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Users</th>
                  <th className="py-3 pr-4 font-medium">Bots</th>
                  <th className="py-3 font-medium">Conversations</th>
                </tr>
              </thead>
              <tbody>
                {(analytics.topCompanies ?? []).map((company) => (
                  <tr key={company.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{company.name}</td>
                    <td className="py-3 pr-4 capitalize text-slate-600">{company.plan}</td>
                    <td className="py-3 pr-4 capitalize text-slate-600">{company.status}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatNumber(company.users)}</td>
                    <td className="py-3 pr-4 text-slate-600">{formatNumber(company.bots)}</td>
                    <td className="py-3 text-slate-600">{formatNumber(company.conversations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <BreakdownCard
          title="Integration health"
          description="Current WhatsApp and Facebook connection states."
          items={analytics.integrationStatusBreakdown}
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <TopBotsCard analytics={analytics} />
        <RecentActivityCard analytics={analytics} />
      </div>

      <IntegrationConfigurationPanel
        title="Company channel configuration"
        description="Choose a company, then add the WhatsApp or Facebook Messenger app keys and tokens used by webhook endpoints."
      />
    </div>
  );
}

function CompanyDashboard({
  analytics,
  bots,
  activeBots,
  selectedBot,
  selectedBotId,
  setSelectedBotId,
  messages,
  input,
  setInput,
  isSending,
  sendMessage,
  bottomRef,
}: {
  analytics: DashboardAnalytics;
  bots: Bot[];
  activeBots: Bot[];
  selectedBot: Bot | null;
  selectedBotId: string;
  setSelectedBotId: (id: string) => void;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  sendMessage: () => void;
  bottomRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-5 py-6 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
                Company support workspace
              </p>
              <h1 className="text-[30px] font-semibold tracking-normal">
                {analytics.companyName ?? "Company"} Dashboard
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-300">
                Company-only support analytics, bot activity, knowledge usage, and live workload.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/inbox" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-50">
                Open inbox
                <ArrowRight size={15} />
              </Link>
              <Link href="/bots" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                Manage bots
                <BotIcon size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Company bots" value={formatNumber(analytics.totalBots)} detail={`${formatNumber(analytics.activeBots)} active bots ready for customers`} icon={BotIcon} tone="cyan" />
        <MetricCard label="Conversations" value={formatNumber(analytics.totalConversations)} detail={`${formatNumber(analytics.openConversations)} open conversations`} icon={MessageSquare} tone="blue" />
        <MetricCard label="Human takeover" value={formatNumber(analytics.humanActiveConversations)} detail="Chats waiting for or controlled by staff" icon={Headphones} tone="amber" />
        <MetricCard label="Knowledge" value={formatNumber(analytics.totalDocuments)} detail={`${formatNumber(Math.round(analytics.storageBytes / 1024))} KB indexed`} icon={FileText} tone="emerald" />
        <MetricCard label="Team" value={formatNumber(analytics.totalUsers)} detail={`${formatNumber(analytics.activeUsers)} active company users`} icon={Users} tone="slate" />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <TrendChart
          title="Company message volume"
          description="Messages for this company over the last six days."
          items={analytics.activity}
        />
        <BreakdownCard
          title="Conversation modes"
          description="AI and human-control workload for this company."
          items={analytics.conversationModeBreakdown}
        />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <BreakdownCard title="Channel mix" description="Where customers are contacting this company." items={analytics.channelBreakdown} />
        <BreakdownCard title="Conversation status" description="Current support queue state." items={analytics.conversationStatusBreakdown} />
        <BreakdownCard title="Bot status" description="Active and draft company bots." items={analytics.botStatusBreakdown} />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <CompanyBotTester
          bots={bots}
          activeBots={activeBots}
          selectedBot={selectedBot}
          selectedBotId={selectedBotId}
          setSelectedBotId={setSelectedBotId}
          messages={messages}
          input={input}
          setInput={setInput}
          isSending={isSending}
          sendMessage={sendMessage}
          bottomRef={bottomRef}
        />
        <div className="space-y-5">
          <TopBotsCard analytics={analytics} />
          <RecentActivityCard analytics={analytics} />
        </div>
      </div>
    </div>
  );
}

function CompanyBotTester({
  bots,
  activeBots,
  selectedBot,
  selectedBotId,
  setSelectedBotId,
  messages,
  input,
  setInput,
  isSending,
  sendMessage,
  bottomRef,
}: {
  bots: Bot[];
  activeBots: Bot[];
  selectedBot: Bot | null;
  selectedBotId: string;
  setSelectedBotId: (id: string) => void;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isSending: boolean;
  sendMessage: () => void;
  bottomRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-end">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Test a company bot
            </label>
            <select
              value={selectedBotId}
              onChange={(event) => setSelectedBotId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              {activeBots.length === 0 ? (
                <option value="">No active bots available</option>
              ) : (
                activeBots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-slate-500">
              Knowledge guardrails
            </p>
            <p className="mt-1 text-[13px] text-slate-600">
              Answers use this company&apos;s uploaded knowledge. Unsupported questions are declined.
            </p>
          </div>
        </div>
      </div>

      <div className="h-[54vh] overflow-y-auto bg-slate-50 px-4 py-4">
        {bots.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">Create a bot to start testing customer answers.</p>
          </div>
        ) : !selectedBot ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">Activate a bot before starting a test chat.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`}>
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-sm bg-cyan-600 text-white"
                        : "rounded-bl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>

                {message.role === "bot" && message.citations && message.citations.length > 0 && (
                  <div className="ml-1 mt-2 space-y-2">
                    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
                      Citations
                    </div>
                    <div className="grid gap-2">
                      {message.citations.map((citation, citationIndex) => (
                        <div
                          key={`${citation.fileName}-${citationIndex}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <p className="text-[12px] font-medium text-slate-700">
                            {citation.fileName}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-slate-500">
                            {citation.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                    {typeof message.latencyMs === "number" && (
                      <p className="text-[11px] text-slate-400">
                        Response time: {message.latencyMs} ms
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                  Finding the best company knowledge...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask a customer question..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            disabled={!selectedBot || isSending}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!selectedBot || !input.trim() || isSending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send test message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function DashboardChatInterface() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const setBottomNode = (node: HTMLDivElement | null) => {
    bottomRef.current = node;
  };

  const activeBots = useMemo(
    () => bots.filter((bot) => bot.status === "active"),
    [bots],
  );
  const selectedBot =
    activeBots.find((bot) => bot.id === selectedBotId) ?? activeBots[0] ?? null;

  useEffect(() => {
    Promise.all([
      fetch("/api/bots?pageSize=100", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/analytics", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([botsData, analyticsData]) => {
        const nextBots = (botsData.bots ?? []) as Bot[];
        setBots(nextBots);
        setAnalytics(analyticsData.analytics ?? null);
        const nextActive = nextBots.filter((bot) => bot.status === "active");
        setSelectedBotId((current) => current || nextActive[0]?.id || "");
      })
      .catch(() => {
        setBots([]);
        setAnalytics(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBot) return;

    setMessages([
      {
        role: "bot",
        text: `Ask about ${selectedBot.name}. I will answer from this company's uploaded knowledge and include citations when available.`,
      },
    ]);
  }, [selectedBot?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !selectedBot || isSending) return;

    setInput("");
    setMessages((current) => [...current, { role: "user", text }]);
    setIsSending(true);

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: selectedBot.id, message: text }),
      });
      const data = (await response.json()) as Partial<ChatResponse> & {
        error?: string;
      };
      setMessages((current) => [
        ...current,
        {
          role: "bot",
          text: data.reply ?? data.error ?? "No response was returned.",
          citations: data.citations ?? [],
          latencyMs: data.latencyMs,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "bot",
          text: "The request could not be completed. Try again in a moment.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm text-slate-500">
        <Gauge className="mr-2 animate-pulse text-cyan-600" size={18} />
        Loading dashboard
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-4 text-slate-300" size={34} />
          <h1 className="text-[24px] font-semibold text-slate-950">Dashboard unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We could not load analytics for this session.
          </p>
        </div>
      </div>
    );
  }

  if (analytics.scope === "platform") {
    return <PlatformDashboard analytics={analytics} />;
  }

  return (
    <CompanyDashboard
      analytics={analytics}
      bots={bots}
      activeBots={activeBots}
      selectedBot={selectedBot}
      selectedBotId={selectedBot?.id ?? selectedBotId}
      setSelectedBotId={setSelectedBotId}
      messages={messages}
      input={input}
      setInput={setInput}
      isSending={isSending}
      sendMessage={() => void sendMessage()}
      bottomRef={setBottomNode}
    />
  );
}
