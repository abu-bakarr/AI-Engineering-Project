"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot as BotIcon, Loader2, MessageSquare, Plus, Radio, Search } from "lucide-react";
import { Bot, UserRole } from "@/lib/types";
import { clearNewBotDraft } from "@/lib/new-bot-draft";
import BotCard from "@/components/BotCard";
import EmptyState from "@/components/EmptyState";

type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function BotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  function startNewBotFlow() {
    clearNewBotDraft();
    router.push("/bots/new");
  }

  function loadBots() {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "12",
    });
    if (query) params.set("search", query);
    if (status !== "all") params.set("status", status);
    Promise.all([
      fetch(`/api/bots?${params}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([botsData, sessionData]) => {
        setBots(botsData.bots ?? []);
        setPageInfo(botsData.pageInfo ?? null);
        setRole(sessionData.session?.role ?? null);
      })
      .catch(() => {
        setBots([]);
        setPageInfo(null);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(loadBots, 200);
    return () => window.clearTimeout(timer);
  }, [query, status, page]);

  const activeBots = bots.filter((b) => b.status === "active").length;
  const totalQueries = bots.reduce((sum, b) => sum + b.totalQueries, 0);
  const canCreateBots =
    role === "super_admin" || role === "company_admin" || role === "company_user";
  const canManageBots = role === "super_admin" || role === "company_admin";

  const stats = [
    { label: "Total bots", value: pageInfo?.total ?? bots.length, icon: BotIcon },
    { label: "Active on page", value: activeBots, icon: Radio },
    { label: "Queries on page", value: totalQueries.toLocaleString(), icon: MessageSquare },
  ];

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">Bots</h1>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Manage every bot, document set, and embed workflow from one workspace.
          </p>
        </div>
        {canCreateBots && (
          <button
            onClick={startNewBotFlow}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 sm:w-auto"
          >
            <Plus size={16} />
            New bot
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon size={16} />
              </div>
            </div>
            <p className="text-[26px] font-semibold tracking-normal text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-950">Your bots</h2>
          <p className="text-[12px] text-slate-500">
            {pageInfo?.total ?? bots.length} bots match your current view
          </p>
        </div>
        <div className="grid w-full gap-2 md:max-w-lg md:grid-cols-[1fr_150px]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search bots"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 size={24} className="animate-spin text-blue-600" />
            <div>
              <p className="text-[15px] font-medium text-slate-900">Loading bots</p>
              <p className="mt-1 text-[13px] text-slate-500">Fetching your workspace bots...</p>
            </div>
          </div>
        </div>
      ) : bots.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={BotIcon}
            title="No bots yet"
            description={
              canManageBots
                ? "Create your first bot to get started"
                : "No company bots are available for your account yet"
            }
            actionLabel={canCreateBots ? "Create bot" : undefined}
            onAction={canCreateBots ? startNewBotFlow : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onDelete={loadBots}
              canManage={canManageBots}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          Page {pageInfo?.page ?? page} of {pageInfo?.totalPages ?? 1}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={isLoading || (pageInfo ? page >= pageInfo.totalPages : true)}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
