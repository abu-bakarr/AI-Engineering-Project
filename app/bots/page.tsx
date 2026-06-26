"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot as BotIcon, Loader2, MessageSquare, Plus, Radio, Search } from "lucide-react";
import { Bot } from "@/lib/types";
import { clearNewBotDraft } from "@/lib/new-bot-draft";
import BotCard from "@/components/BotCard";
import EmptyState from "@/components/EmptyState";

export default function BotsPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function startNewBotFlow() {
    clearNewBotDraft();
    router.push("/bots/new");
  }

  function loadBots() {
    setIsLoading(true);
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => setBots(data.bots ?? []))
      .catch(() => setBots([]))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadBots();
  }, []);

  const activeBots = bots.filter((b) => b.status === "active").length;
  const totalQueries = bots.reduce((sum, b) => sum + b.totalQueries, 0);

  const filteredBots = bots.filter((bot) => {
    const value = `${bot.name} ${bot.description}`.toLowerCase();
    return value.includes(query.trim().toLowerCase());
  });

  const stats = [
    { label: "Total bots", value: bots.length, icon: BotIcon },
    { label: "Active bots", value: activeBots, icon: Radio },
    { label: "Total queries", value: totalQueries.toLocaleString(), icon: MessageSquare },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">Bots</h1>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Manage every bot, document set, and embed workflow from one workspace.
          </p>
        </div>
        <button
          onClick={startNewBotFlow}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 sm:w-auto"
        >
          <Plus size={16} />
          New bot
        </button>
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
          <p className="text-[12px] text-slate-500">{filteredBots.length} visible in this workspace</p>
        </div>
        <div className="relative w-full md:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search bots"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
          />
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
            description="Create your first bot to get started"
            actionLabel="Create bot"
            onAction={startNewBotFlow}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredBots.map((bot) => (
            <BotCard key={bot.id} bot={bot} onDelete={loadBots} />
          ))}
        </div>
      )}
    </div>
  );
}
