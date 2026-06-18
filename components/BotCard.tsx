"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2, MessageCircle, Trash2, X } from "lucide-react";
import { Bot } from "@/lib/types";
import {
  clearPersistentPreviewBotId,
  setPersistentPreviewBotId,
} from "@/components/PersistentBotTester";

interface BotCardProps {
  bot: Bot;
  onDelete: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function BotCard({ bot, onDelete }: BotCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canPreview = bot.documents.some((document) => document.status === "ready");

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "DELETE",
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error("Delete failed");
      }
      clearPersistentPreviewBotId(bot.id);
      setConfirmOpen(false);
      onDelete();
    } catch {
      // Keep modal open so the user can retry if deletion request fails.
    } finally {
      clearTimeout(timeout);
      setIsDeleting(false);
    }
  }

  return (
    <>
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <button
          type="button"
          onClick={() => {
            if (canPreview) {
              setPersistentPreviewBotId(bot.id);
            }
            router.push(`/bots/${bot.id}`);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        style={{
          backgroundColor: hexToRgba(bot.accentColor, 0.15),
          color: bot.accentColor,
        }}
      >
        {bot.logoDataUrl ? (
          <img
            src={bot.logoDataUrl}
            alt={`${bot.name} logo`}
            className="h-11 w-11 rounded-lg object-cover"
          />
        ) : (
          bot.initials
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-[15px] font-semibold text-slate-950">{bot.name}</p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-slate-500">
          {bot.description || "No description added"}
        </p>
        <p className="mt-1 text-[12px] text-slate-400">
          {bot.documents.length} document{bot.documents.length !== 1 ? "s" : ""} ·{" "}
          {bot.totalQueries.toLocaleString()} queries
        </p>
      </div>
        </button>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium ${
          bot.status === "active"
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {bot.status === "active" ? "Active" : "Draft"}
      </span>

      <button
        onClick={() => {
          if (canPreview) {
            setPersistentPreviewBotId(bot.id);
          }
          router.push(`/bots/${bot.id}/docs`);
        }}
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50"
      >
        Docs
      </button>

      <button
        onClick={() => {
          if (canPreview) {
            setPersistentPreviewBotId(bot.id);
          }
          router.push(`/bots/${bot.id}/embed`);
        }}
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50"
      >
        Embed
      </button>

      <button
        type="button"
        onClick={() => {
          if (!canPreview) return;
          setPersistentPreviewBotId(bot.id);
        }}
        disabled={!canPreview}
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Preview
      </button>

      <button
        onClick={() => setConfirmOpen(true)}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
        title="Delete bot"
      >
        <Trash2 size={15} />
      </button>
      </div>
      </div>
    </div>
    {confirmOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/35 px-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-2xl border border-gray-100">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-[15px] font-medium text-gray-900">Delete {bot.name}?</h3>
                <p className="mt-1 text-[13px] leading-5 text-gray-500">
                  This permanently removes the bot, its document records, uploaded files, and vector data. Other bots will not be affected.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              disabled={isDeleting}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 px-5 py-4 text-[12px] text-gray-500">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-gray-700">
                <FileText size={13} />
                Documents
              </div>
              {bot.documents.length} item{bot.documents.length !== 1 ? "s" : ""}
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-gray-700">
                <MessageCircle size={13} />
                Queries
              </div>
              {bot.totalQueries.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 size={14} className="animate-spin" />}
              Delete bot
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
