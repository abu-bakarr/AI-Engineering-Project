"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Clock,
  Headphones,
  Loader2,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import { Conversation } from "@/lib/types";

const channels = ["all", "web", "whatsapp", "facebook"];
const statuses = ["all", "open", "pending", "resolved", "closed"];

function badgeClass(value: string) {
  if (value === "HUMAN_ACTIVE") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (value === "AI_ACTIVE") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value === "closed" || value === "resolved") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-cyan-50 text-cyan-700 ring-cyan-200";
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (channel !== "all") params.set("channel", channel);
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/conversations?${params}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not load inbox.");
      setConversations(data.conversations ?? []);
      setSelectedId((current) => current ?? data.conversations?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [query, channel, status]);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? conversations[0],
    [conversations, selectedId],
  );

  async function action(id: string, actionName: "join" | "return_to_ai" | "resolve" | "close") {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName }),
    });
    if (response.ok) await load();
  }

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">Unified inbox</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            Monitor website, WhatsApp, and Facebook conversations with safe handoff controls.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[12px] text-slate-600">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">{conversations.length} visible</span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">{conversations.filter((c) => c.mode === "HUMAN_ACTIVE").length} human</span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">{conversations.filter((c) => c.mode === "AI_ACTIVE").length} AI</span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(220px,1fr)_180px_180px]">
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer, subject, or email"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20"
          />
        </label>
        <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {channels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid min-h-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[380px_minmax(0,1fr)_320px]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 animate-spin text-cyan-600" size={18} /> Loading inbox
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No conversations match the current filters.</div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selected?.id === conversation.id ? "bg-cyan-50/60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-950">{conversation.contact?.name ?? conversation.contact?.email ?? "Unknown customer"}</p>
                    <p className="mt-1 truncate text-[12px] text-slate-500">{conversation.subject ?? "No subject"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${badgeClass(conversation.mode)}`}>{conversation.mode}</span>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-500">
                  <span>{conversation.channel}</span>
                  <span>{conversation.priority}</span>
                  <span>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : "New"}</span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-[16px] font-semibold text-slate-950">{selected?.subject ?? "Select a conversation"}</h2>
            <p className="mt-1 text-[12px] text-slate-500">{selected?.botName ?? "No bot"} · {selected?.channel ?? "channel"}</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
            {(selected?.messages ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Recent messages will appear here after webhook or widget traffic is received.
              </div>
            ) : (
              selected?.messages?.map((message) => (
                <div key={message.id} className={`max-w-[78%] rounded-lg px-4 py-3 text-sm shadow-sm ${message.senderType === "customer" ? "bg-white text-slate-700" : "ml-auto bg-cyan-600 text-white"}`}>
                  <p>{message.body}</p>
                  <p className="mt-2 text-[11px] opacity-70">{message.senderType} · {new Date(message.createdAt).toLocaleTimeString()}</p>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
              <Send size={15} />
              Agent replies are enabled when outbound channel credentials are connected.
            </div>
          </div>
        </section>

        <aside className="border-t border-slate-200 p-4 lg:border-l lg:border-t-0">
          <h3 className="text-[14px] font-semibold text-slate-950">Customer profile</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[12px] text-slate-500">Name</p>
              <p className="font-medium text-slate-900">{selected?.contact?.name ?? "Unknown"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[12px] text-slate-500">Contact</p>
              <p className="text-slate-700">{selected?.contact?.email ?? selected?.contact?.phone ?? "Not captured"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[12px] text-slate-500">Consent</p>
              <p className="text-slate-700">{selected?.contact?.consentStatus ?? "unknown"}</p>
            </div>
          </div>
          {selected && (
            <div className="mt-5 grid gap-2">
              <button onClick={() => action(selected.id, "join")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">
                <Headphones size={15} /> Join chat
              </button>
              <button onClick={() => action(selected.id, "return_to_ai")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <Bot size={15} /> Return to AI
              </button>
              <button onClick={() => action(selected.id, "resolve")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                <Clock size={15} /> Mark resolved
              </button>
              <div className="rounded-lg bg-slate-50 p-3 text-[12px] leading-5 text-slate-500">
                <MessageSquare size={14} className="mb-2 text-cyan-700" />
                Agent assist can surface summaries, suggested replies, sentiment, and knowledge recommendations once message history is available.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
