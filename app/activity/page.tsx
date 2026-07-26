"use client";

import { useEffect, useState } from "react";
import { Filter, Loader2, Search, ShieldCheck } from "lucide-react";
import { ActivityLog } from "@/lib/types";

const types = [
  "all",
  "user.invited",
  "user.updated",
  "bot.created",
  "bot.updated",
  "bot.deleted",
  "conversation.opened",
  "conversation.join",
  "conversation.return_to_ai",
  "company.updated",
];

export default function ActivityPage() {
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query) params.set("search", query);
        if (type !== "all") params.set("type", type);
        const response = await fetch(`/api/activity?${params}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Could not load activity.");
        setActivity(data.activity ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load activity.");
      } finally {
        setIsLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, type]);

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-slate-950">Company activity</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
          A secure activity history for user changes, bot updates, conversations, integrations, subscriptions, and security events.
        </p>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(240px,1fr)_260px]">
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
          />
        </label>
        <label className="relative block">
          <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin text-cyan-600" />
            Loading activity
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : activity.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 text-slate-300" size={28} />
            <h2 className="text-[15px] font-semibold text-slate-950">No activity found</h2>
            <p className="mt-1 text-sm text-slate-500">Try a different search or action filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activity.map((item) => (
              <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_180px_220px] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[12px] font-medium text-cyan-700 ring-1 ring-cyan-200">
                      {item.type}
                    </span>
                    {item.resourceType && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600">
                        {item.resourceType}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.message}</p>
                  <p className="mt-1 truncate font-mono text-[12px] text-slate-400">{item.resourceId ?? item.id}</p>
                </div>
                <div className="text-[12px] text-slate-500">
                  <p>{item.ipAddress ?? "IP unavailable"}</p>
                  <p className="mt-1 truncate">{item.userAgent ?? "User agent unavailable"}</p>
                </div>
                <time className="text-[12px] text-slate-500 md:text-right">
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
