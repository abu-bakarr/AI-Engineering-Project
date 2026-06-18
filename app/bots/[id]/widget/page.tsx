"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Send } from "lucide-react";
import { Bot, ChatCitation, ChatResponse } from "@/lib/types";

interface Message {
  role: "user" | "bot";
  text: string;
  citations?: ChatCitation[];
  latencyMs?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function WidgetPage() {
  const params = useParams();
  const id = params.id as string;
  const [bot, setBot] = useState<Bot | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/bots/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const fetched: Bot | null = data?.bot ?? null;
        setBot(fetched);
        if (fetched) {
          setMessages([
            { role: "bot", text: `Hi! I'm ${fetched.name}. How can I help you today?` },
          ]);
        }
      })
      .catch(() => setBot(null));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || typing) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: id, message: text }),
      });
      const data = (await res.json()) as Partial<ChatResponse> & { error?: string };
      const reply: string = data.reply ?? data.error ?? "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: reply,
          citations: data.citations ?? [],
          latencyMs: data.latencyMs,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Network error. Please try again." },
      ]);
    } finally {
      setTyping(false);
    }
  }

  if (bot === undefined) {
    return (
      <div className="flex h-screen flex-col bg-white">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-100 px-4">
          <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="flex-1 space-y-3 overflow-hidden px-4 py-4">
          <div className="h-9 w-4/5 animate-pulse rounded-2xl bg-slate-100" />
          <div className="ml-auto h-9 w-2/3 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-9 w-3/5 animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  if (bot === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-slate-500">Bot not found.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 border-b border-slate-100 bg-white shrink-0"
        style={{ height: 48 }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium shrink-0 overflow-hidden"
          style={{
            backgroundColor: hexToRgba(bot.accentColor, 0.15),
            color: bot.accentColor,
          }}
        >
          {bot.logoDataUrl ? (
            <img
              src={bot.logoDataUrl}
              alt={bot.name}
              className="w-7 h-7 object-cover"
            />
          ) : (
            bot.initials
          )}
        </div>
        <span className="text-sm font-medium text-slate-800 truncate">{bot.name}</span>
        <span
          className={`ml-auto text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
            bot.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {bot.status === "active" ? "Active" : "Draft"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="space-y-2">
            <div
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
                style={msg.role === "user" ? { backgroundColor: bot.accentColor } : {}}
              >
                {msg.text}
              </div>
            </div>

            {msg.role === "bot" && msg.citations && msg.citations.length > 0 && (
              <div className="space-y-2 pl-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Citations
                </div>
                <div className="grid gap-2">
                  {msg.citations.map((citation, citationIndex) => (
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
                {typeof msg.latencyMs === "number" && (
                  <p className="text-[11px] text-slate-400">Latency: {msg.latencyMs} ms</p>
                )}
              </div>
            )}
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-3 py-2 rounded-2xl rounded-bl-sm">
              <span className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || typing}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
            style={{ backgroundColor: bot.accentColor }}
          >
            <Send size={13} className="text-white" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-400 py-2 shrink-0">
        Powered by DSTI
      </div>
    </div>
  );
}
