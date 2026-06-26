"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { Bot, ChatCitation, ChatResponse } from "@/lib/types";

type Message = {
  role: "user" | "bot";
  text: string;
  citations?: ChatCitation[];
  latencyMs?: number;
};

export default function DashboardChatInterface() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeBots = useMemo(
    () => bots.filter((bot) => bot.status === "active"),
    [bots],
  );
  const selectedBot =
    activeBots.find((bot) => bot.id === selectedBotId) ?? activeBots[0] ?? null;

  useEffect(() => {
    fetch("/api/bots")
      .then((response) => response.json())
      .then((data) => {
        const nextBots = (data.bots ?? []) as Bot[];
        setBots(nextBots);
        const nextActive = nextBots.filter((bot) => bot.status === "active");
        setSelectedBotId((current) => current || nextActive[0]?.id || "");
      })
      .catch(() => setBots([]));
  }, []);

  useEffect(() => {
    if (!selectedBot) return;

    setMessages([
      {
        role: "bot",
        text: `Ask about ${selectedBot.name}. Answers are restricted to the uploaded corpus and include citations.`,
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
          text: data.reply ?? data.error ?? "No response returned.",
          citations: data.citations ?? [],
          latencyMs: data.latencyMs,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "bot",
          text: "Request failed. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-950">RAG Chat Interface</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-500">
            This workspace chat uses the same retrieval pipeline as the embeddable widget and returns grounded answers with citations from the selected bot corpus.
          </p>
        </div>
        <Link
          href="/bots"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Open admin
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-end">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Active bot
            </label>
            <select
              value={selectedBot?.id ?? ""}
              onChange={(event) => setSelectedBotId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
              Corpus guardrails
            </p>
            <p className="mt-1 text-[13px] text-slate-600">
              Answers are restricted to uploaded documents. Unsupported questions are refused instead of answered from general knowledge.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="h-[62vh] overflow-y-auto bg-slate-50 px-4 py-4">
          {!selectedBot ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">
                Create and activate a bot in the admin panel to start chatting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`}>
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "rounded-br-sm bg-blue-600 text-white"
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
                          Latency: {message.latencyMs} ms
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                    Retrieving context...
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
                  void sendMessage();
                }
              }}
              placeholder="Ask a policy question..."
              className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              disabled={!selectedBot || isSending}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!selectedBot || !input.trim() || isSending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
