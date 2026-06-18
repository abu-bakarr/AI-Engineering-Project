"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Bot } from "@/lib/types";

interface BotStatusPanelProps {
  bot: Bot;
  onStatusChange: (status: Bot["status"]) => Promise<void> | void;
}

export default function BotStatusPanel({
  bot,
  onStatusChange,
}: BotStatusPanelProps) {
  const [pendingStatus, setPendingStatus] = useState<Bot["status"] | null>(null);
  const [error, setError] = useState("");

  async function handleChange(status: Bot["status"]) {
    if (status === bot.status || pendingStatus) return;

    setPendingStatus(status);
    setError("");

    try {
      await onStatusChange(status);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update bot status.",
      );
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-950">Bot status</h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Active bots are ready to be embedded. Draft bots stay available for editing.
          </p>
        </div>

        <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto">
          {(["draft", "active"] as const).map((status) => {
            const isSelected = bot.status === status;
            const isPending = pendingStatus === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => void handleChange(status)}
                disabled={Boolean(pendingStatus)}
                className={`inline-flex min-w-[116px] items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  isSelected
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
