"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepIndicator from "@/components/StepIndicator";
import FileUploadZone from "@/components/FileUploadZone";
import EmbedCodeBlock from "@/components/EmbedCodeBlock";
import { setPersistentPreviewBotId } from "@/components/PersistentBotTester";
import { NEW_BOT_DRAFT_STORAGE_KEY } from "@/lib/new-bot-draft";
import { Bot, BotDocument } from "@/lib/types";
import { mergeIncomingDocuments } from "@/lib/documents";

const STEPS = ["Details", "Documents", "Embed code"];
const DEFAULT_ACCENT_COLOR = "#2563eb";

function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function NewBotPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isRestoring, setIsRestoring] = useState(true);

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [nameError, setNameError] = useState("");
  const [colorError, setColorError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Created bot
  const [createdBot, setCreatedBot] = useState<Bot | null>(null);

  // Step 2 state — tracks all files across "processing" → "ready" updates
  const [uploadedFiles, setUploadedFiles] = useState<BotDocument[]>([]);
  const [docsError, setDocsError] = useState("");
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const hasReadyDocuments = uploadedFiles.some((file) => file.status === "ready");
  const hasProcessingDocuments = uploadedFiles.some(
    (file) => file.status === "processing",
  );
  const canContinueFromDocuments =
    hasReadyDocuments && !isUploadingDocuments && !hasProcessingDocuments;

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Always start a fresh bot setup flow when opening the new bot page.
      window.sessionStorage.removeItem(NEW_BOT_DRAFT_STORAGE_KEY);
    }
    setIsRestoring(false);
  }, []);

  useEffect(() => {
    if (!createdBot) return;

    setCreatedBot((current) =>
      current && current.id === createdBot.id
        ? { ...current, documents: uploadedFiles }
        : current,
    );

    setPersistentPreviewBotId(hasReadyDocuments ? createdBot.id : null);
  }, [createdBot?.id, hasReadyDocuments, uploadedFiles]);

  useEffect(() => {
    if (typeof window === "undefined" || isRestoring) return;

    if (!createdBot || step === 0) {
      window.sessionStorage.removeItem(NEW_BOT_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      NEW_BOT_DRAFT_STORAGE_KEY,
      JSON.stringify({ step, botId: createdBot.id }),
    );
  }, [createdBot, isRestoring, step]);

  useEffect(() => {
    if (
      step !== 1 ||
      !createdBot ||
      !hasReadyDocuments ||
      isUploadingDocuments ||
      hasProcessingDocuments
    ) {
      return;
    }

    const readyDocs = uploadedFiles.filter((file) => file.status === "ready");
    if (readyDocs.length === 0) return;

    setDocsError("");
    setCreatedBot((current) =>
      current
        ? { ...current, documents: readyDocs, status: "active" }
        : current,
    );
    setPersistentPreviewBotId(createdBot.id);
    fetch(`/api/bots/${createdBot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: readyDocs, status: "active" }),
    }).catch(() => {});
    setStep(2);
  }, [
    createdBot,
    hasProcessingDocuments,
    hasReadyDocuments,
    isUploadingDocuments,
    step,
    uploadedFiles,
  ]);

  async function handleStep1Continue() {
    if (!name.trim()) {
      setNameError("Bot name is required");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
      setColorError("Use a valid hex color, for example #2563eb.");
      return;
    }
    setColorError("");
    setNameError("");
    setSubmitError("");

    const bot: Bot = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      accentColor,
      logoDataUrl: logoDataUrl || undefined,
      initials: deriveInitials(name),
      createdAt: new Date().toISOString(),
      documents: [],
      status: "draft",
      totalQueries: 0,
    };

    try {
      setIsCreating(true);
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bot),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not create bot.");
      }
      setCreatedBot(data.bot ?? bot);
      setStep(1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create bot.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleFilesAdded(incoming: BotDocument[]) {
    setUploadedFiles((prev) => mergeIncomingDocuments(prev, incoming));
    if (incoming.some((file) => file.status === "ready")) {
      setDocsError("");
    }
  }

  function handleDeleteBufferedDoc(docId: string) {
    const next = uploadedFiles.filter((document) => document.id !== docId);
    setUploadedFiles(next);
    if (createdBot) {
      fetch(`/api/bots/${createdBot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: next }),
      }).catch(() => {});
    }
  }

  function handleStep2Continue() {
    if (isUploadingDocuments || hasProcessingDocuments) {
      setDocsError("Wait for upload and indexing to finish before continuing.");
      return;
    }
    const readyDocs = uploadedFiles.filter((f) => f.status === "ready");
    if (readyDocs.length === 0) {
      setDocsError("At least one document is required before continuing.");
      return;
    }
    setDocsError("");
    if (createdBot) {
      setCreatedBot((current) =>
        current
          ? { ...current, documents: readyDocs, status: "active" }
          : current,
      );
      setPersistentPreviewBotId(createdBot.id);
      fetch(`/api/bots/${createdBot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: readyDocs, status: "active" }),
      }).catch(() => {});
    }
    setStep(2);
  }

  if (isRestoring) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8" aria-busy="true">
        <div className="mb-2">
          <button
            onClick={() => router.push("/bots")}
            className="mb-4 inline-block text-[13px] text-gray-400 transition-colors duration-150 hover:text-gray-600"
          >
            ← Bots
          </button>
          <h1 className="text-[18px] font-medium text-gray-900">Create new bot</h1>
        </div>

        <div className="mb-6 mt-4 flex justify-start sm:mb-8">
          <StepIndicator steps={STEPS} current={step} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-24 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-2">
          <button
            onClick={() => router.push("/bots")}
            className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors duration-150 mb-4 inline-block"
          >
            ← Bots
          </button>
          <h1 className="text-[18px] font-medium text-gray-900">Create new bot</h1>
        </div>

        <div className="mb-6 mt-4 flex justify-start sm:mb-8">
          <StepIndicator steps={STEPS} current={step} />
        </div>

        {step === 0 && (
          <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-5">
            <div>
              <label className="block text-[13px] text-gray-600 mb-1.5">
                Bot name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="e.g. PReSTrack Support Bot"
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors duration-150 ${
                  nameError ? "border-red-400" : "border-gray-200"
                }`}
              />
              {nameError && (
                <p className="text-[12px] text-red-500 mt-1">{nameError}</p>
              )}
            </div>

            <div>
              <label className="block text-[13px] text-gray-600 mb-1.5">
                Logo <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setLogoDataUrl(String(reader.result || ""));
                  reader.readAsDataURL(file);
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="block text-[13px] text-gray-600 mb-1.5">
                Description{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this bot help users with?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors duration-150 resize-none"
              />
            </div>

            <div>
              <label className="block text-[13px] text-gray-600 mb-2">
                Hex color
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR}
                  onChange={(e) => {
                    setAccentColor(e.target.value);
                    setColorError("");
                  }}
                  className="h-10 w-12 rounded-lg border border-gray-200 bg-white p-1"
                  title="Choose color"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => {
                    setAccentColor(e.target.value.trim());
                    setColorError("");
                  }}
                  placeholder="#2563eb"
                  className={`w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:w-40 ${
                    colorError ? "border-red-400" : "border-gray-200"
                  }`}
                />
                <div
                  className="h-9 w-9 rounded-lg border border-gray-100"
                  style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-gray-400">
                This color is used for the bot icon, widget button, and chat header.
              </p>
              {colorError && (
                <p className="text-[12px] text-red-500 mt-1">{colorError}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={handleStep1Continue}
                disabled={isCreating}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isCreating ? "Creating..." : "Continue"}
              </button>
              {submitError && (
                <p className="mt-2 text-[12px] text-red-500">{submitError}</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-5">
            <div>
              <h2 className="text-[14px] font-medium text-gray-900 mb-1">
                Add bot knowledge
              </h2>
              <p className="text-[13px] text-gray-400 mb-4">
                Upload policy files or type up to 500 words. Supported formats: PDF, DOCX, MD, TXT, and HTML. This content is private to this bot.
              </p>
              <FileUploadZone
                botId={createdBot?.id ?? ""}
                files={uploadedFiles}
                onFilesAdded={handleFilesAdded}
                onDeleteDoc={handleDeleteBufferedDoc}
                allowRichText
                onUploadStateChange={setIsUploadingDocuments}
              />
              {docsError && (
                <p className="text-[12px] text-red-500 mt-2">{docsError}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <button
                onClick={handleStep2Continue}
                disabled={!canContinueFromDocuments}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isUploadingDocuments || hasProcessingDocuments
                  ? "Indexing..."
                  : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && createdBot && (
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <h2 className="text-[14px] font-medium text-gray-900 mb-1">
                Your bot is ready
              </h2>
              <p className="text-[13px] text-gray-400 mb-5">
                Copy the snippet below and paste it into any website to add the
                chat widget.
              </p>
              <EmbedCodeBlock botId={createdBot.id} botName={createdBot.name} />
            </div>

            <button
              onClick={() => router.push("/bots")}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 sm:w-auto"
            >
              Go to bots
            </button>
          </div>
        )}
      </div>
    </>
  );
}
