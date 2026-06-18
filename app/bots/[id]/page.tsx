"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, MessageSquare, Calendar, Zap, Trash2, Pencil, X, Loader2 } from "lucide-react";
import { Bot } from "@/lib/types";
import BotStatusPanel from "@/components/BotStatusPanel";
import { clearPersistentPreviewBotId } from "@/components/PersistentBotTester";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [bot, setBot] = useState<Bot | null | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAccentColor, setEditAccentColor] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [editColorError, setEditColorError] = useState("");
  const [editSubmitError, setEditSubmitError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    setBot(undefined);
    fetch(`/api/bots/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setBot(data?.bot ?? null))
      .catch(() => setBot(null));
  }, [id]);

  if (bot === undefined) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8" aria-busy="true">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-gray-400">
          <Link href="/bots" className="hover:text-gray-600 transition-colors duration-150">
            Bots
          </Link>
          <span>/</span>
          <span className="text-gray-500">Loading...</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-72 rounded bg-slate-100" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-20 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (bot === null) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <Link
          href="/bots"
          className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors duration-150 mb-4 inline-block"
        >
          ← Bots
        </Link>
        <div className="bg-white rounded-lg border border-gray-100 p-10 text-center">
          <p className="text-[15px] font-medium text-gray-700 mb-1">Bot not found</p>
          <p className="text-[13px] text-gray-400 mb-5">
            This bot doesn&apos;t exist or has been deleted.
          </p>
          <Link
            href="/bots"
            className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm transition-colors duration-150"
          >
            Back to bots
          </Link>
        </div>
      </div>
    );
  }

  async function handleDelete() {
    if (isDeleting) return;
    if (!window.confirm("Delete this bot?")) return;

    setDeleteError("");
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/bots/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete bot.");
      }

      clearPersistentPreviewBotId(id);
      router.push("/bots");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete bot.");
    } finally {
      setIsDeleting(false);
    }
  }

  const createdDate = new Date(bot.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  async function handleStatusChange(status: Bot["status"]) {
    const response = await fetch(`/api/bots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Could not update bot status.");
    }

    setBot((current) => (current ? { ...current, status } : current));
  }

  function openEditModal() {
    if (!bot) return;
    setEditName(bot.name);
    setEditDescription(bot.description);
    setEditAccentColor(bot.accentColor);
    setEditNameError("");
    setEditColorError("");
    setEditSubmitError("");
    setIsEditModalOpen(true);
  }

  async function handleSaveDetails() {
    if (!bot || isSavingEdit) return;

    if (!editName.trim()) {
      setEditNameError("Bot name is required.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(editAccentColor)) {
      setEditColorError("Use a valid hex color, for example #2563eb.");
      return;
    }

    setIsSavingEdit(true);
    setEditNameError("");
    setEditColorError("");
    setEditSubmitError("");

    const payload = {
      name: editName.trim(),
      description: editDescription.trim(),
      accentColor: editAccentColor,
      initials: deriveInitials(editName),
    };

    try {
      const response = await fetch(`/api/bots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not update bot details.");
      }

      setBot((current) => (current ? { ...current, ...payload } : current));
      setIsEditModalOpen(false);
    } catch (error) {
      setEditSubmitError(
        error instanceof Error ? error.message : "Could not update bot details.",
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <Link
        href="/bots"
        className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors duration-150 mb-4 inline-block"
      >
        ← Bots
      </Link>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
            style={{
              backgroundColor: hexToRgba(bot.accentColor, 0.15),
              color: bot.accentColor,
            }}
          >
            {bot.logoDataUrl ? (
              <img
                src={bot.logoDataUrl}
                alt={`${bot.name} logo`}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              bot.initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-medium text-gray-900">{bot.name}</h1>
            {bot.description && (
              <p className="text-[13px] text-gray-400 mt-1">{bot.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              title="Edit bot details"
            >
              <Pencil size={15} />
            </button>
            <span
              className={`w-fit rounded-full px-2.5 py-1 text-[12px] font-medium ${
                bot.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {bot.status === "active" ? "Active" : "Draft"}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, label: "Documents", value: bot.documents.length },
            {
              icon: MessageSquare,
              label: "Total queries",
              value: bot.totalQueries.toLocaleString(),
            },
            { icon: Zap, label: "Status", value: bot.status === "active" ? "Active" : "Draft" },
            { icon: Calendar, label: "Created", value: createdDate },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} className="text-gray-400" />
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
              <p className="text-[14px] font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/bots/${id}/docs`}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="flex items-center gap-3 mb-2">
            <FileText size={18} className="text-blue-600" />
            <span className="text-[14px] font-medium text-gray-900">
              Manage documents
            </span>
          </div>
          <p className="text-[13px] text-gray-400">
            Upload, view, and remove knowledge base files for this bot.
          </p>
        </Link>

        <Link
          href={`/bots/${id}/embed`}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-150 hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="flex items-center gap-3 mb-2">
            <Zap size={18} className="text-blue-600" />
            <span className="text-[14px] font-medium text-gray-900">
              Get embed code
            </span>
          </div>
          <p className="text-[13px] text-gray-400">
            Copy the embed snippet to add this bot to any website.
          </p>
        </Link>
      </div>

      <div className="mb-4">
        <BotStatusPanel bot={bot} onStatusChange={handleStatusChange} />
      </div>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 sm:w-auto"
      >
        <Trash2 size={14} />
        {isDeleting ? "Deleting..." : "Delete bot"}
      </button>
      {deleteError && (
        <p className="mt-2 text-sm text-red-600">{deleteError}</p>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">Bot details</h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Update the bot name, description, and accent color used across the widget.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSavingEdit}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-600">Bot name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => {
                      setEditName(event.target.value);
                      if (editNameError) setEditNameError("");
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                      editNameError ? "border-red-400" : "border-slate-200"
                    }`}
                  />
                  {editNameError && (
                    <p className="mt-1 text-[12px] text-red-500">{editNameError}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-600">Description</label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] text-slate-600">Accent color</label>
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(editAccentColor) ? editAccentColor : "#2563eb"}
                      onChange={(event) => {
                        setEditAccentColor(event.target.value);
                        if (editColorError) setEditColorError("");
                      }}
                      className="h-11 w-12 rounded-lg border border-slate-200 bg-white p-1"
                      title="Choose color"
                    />
                    <input
                      type="text"
                      value={editAccentColor}
                      onChange={(event) => {
                        setEditAccentColor(event.target.value.trim());
                        if (editColorError) setEditColorError("");
                      }}
                      placeholder="#2563eb"
                      className={`w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ${
                        editColorError ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-[12px] font-medium text-slate-500">Preview</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold"
                        style={{
                          backgroundColor: hexToRgba(
                            /^#[0-9a-fA-F]{6}$/.test(editAccentColor)
                              ? editAccentColor
                              : "#2563eb",
                            0.15,
                          ),
                          color: /^#[0-9a-fA-F]{6}$/.test(editAccentColor)
                            ? editAccentColor
                            : "#2563eb",
                        }}
                      >
                        {deriveInitials(editName || bot.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-900">
                          {editName.trim() || bot.name}
                        </p>
                        <p className="truncate text-[12px] text-slate-500">
                          Widget header and button styling
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {editColorError && (
                  <p className="mt-1 text-[12px] text-red-500">{editColorError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <div className="min-h-[20px] text-[12px] text-red-600">{editSubmitError}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveDetails()}
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingEdit && <Loader2 size={14} className="animate-spin" />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
