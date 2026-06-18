"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Bot } from "@/lib/types";
import BotStatusPanel from "@/components/BotStatusPanel";
import EmbedCodeBlock from "@/components/EmbedCodeBlock";
import { setPersistentPreviewBotId } from "@/components/PersistentBotTester";

export default function BotEmbedPage() {
  const params = useParams();
  const id = params.id as string;
  const [bot, setBot] = useState<Bot | null | undefined>(undefined);

  async function activateBotIfNeeded(nextBot: Bot | null) {
    if (!nextBot) return nextBot;
    const hasReadyDocuments = nextBot.documents.some((document) => document.status === "ready");

    if (hasReadyDocuments) {
      setPersistentPreviewBotId(nextBot.id);
    } else {
      setPersistentPreviewBotId(null);
    }

    if (nextBot.status === "draft" && hasReadyDocuments) {
      const response = await fetch(`/api/bots/${nextBot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });

      if (response.ok) {
        return { ...nextBot, status: "active" as const };
      }
    }

    return nextBot;
  }

  useEffect(() => {
    setBot(undefined);
    fetch(`/api/bots/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const fetchedBot: Bot | null = data?.bot ?? null;
        setBot(await activateBotIfNeeded(fetchedBot));
      })
      .catch(() => setBot(null));
  }, [id]);

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
          <div className="h-6 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-80 rounded bg-slate-100" />
          <div className="mt-6 h-52 rounded bg-slate-100" />
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-gray-400">
        <Link href="/bots" className="hover:text-gray-600 transition-colors duration-150">
          Bots
        </Link>
        <span>/</span>
        <Link
          href={`/bots/${id}`}
          className="hover:text-gray-600 transition-colors duration-150"
        >
          {bot.name}
        </Link>
        <span>/</span>
        <span className="text-gray-600">Embed code</span>
      </div>

      <h1 className="mb-2 text-[22px] font-semibold text-slate-950">Embed code</h1>
      <p className="mb-6 max-w-2xl text-[13px] leading-5 text-slate-500">
        Copy the code below and paste it into any website or app where you want
        this bot to appear.
      </p>

      <div className="mb-6">
        <BotStatusPanel bot={bot} onStatusChange={handleStatusChange} />
      </div>

      <EmbedCodeBlock botId={bot.id} botName={bot.name} />

      <p className="text-[13px] text-gray-400 italic mt-4">
        Each project gets its own unique bot ID. The same snippet works on any
        website.
      </p>
    </div>
  );
}
