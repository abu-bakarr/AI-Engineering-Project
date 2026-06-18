"use client";

import { useCallback, useEffect, useState } from "react";
import FloatingBotTester from "@/components/FloatingBotTester";
import { Bot } from "@/lib/types";

const PREVIEW_STORAGE_KEY = "rag_platform_preview_bot_id";
const PREVIEW_CHANGED_EVENT = "rag-platform-preview-bot-changed";

type PreviewChangedEvent = CustomEvent<{ botId: string | null }>;

function hasReadyDocuments(bot: Bot): boolean {
  return bot.documents.some((document) => document.status === "ready");
}

export function setPersistentPreviewBotId(botId: string | null): void {
  if (typeof window === "undefined") return;

  if (botId) {
    localStorage.setItem(PREVIEW_STORAGE_KEY, botId);
  } else {
    localStorage.removeItem(PREVIEW_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(PREVIEW_CHANGED_EVENT, { detail: { botId } }),
  );
}

export function clearPersistentPreviewBotId(botId: string): void {
  if (getStoredPreviewBotId() === botId) {
    setPersistentPreviewBotId(null);
  }
}

function getStoredPreviewBotId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PREVIEW_STORAGE_KEY);
}

export default function PersistentBotTester() {
  const [bot, setBot] = useState<Bot | null>(null);

  const loadPreviewBot = useCallback(async (botId: string | null) => {
    if (!botId) {
      setBot(null);
      return;
    }

    try {
      const response = await fetch(`/api/bots/${botId}`, { cache: "no-store" });
      if (!response.ok) {
        setPersistentPreviewBotId(null);
        setBot(null);
        return;
      }

      const data = (await response.json()) as { bot?: Bot };
      if (data.bot && hasReadyDocuments(data.bot)) {
        setBot(data.bot);
        return;
      }

      setPersistentPreviewBotId(null);
      setBot(null);
    } catch {
      // Keep the current preview visible during transient network failures.
    }
  }, []);

  useEffect(() => {
    void loadPreviewBot(getStoredPreviewBotId());

    function handlePreviewChanged(event: Event) {
      const botId = (event as PreviewChangedEvent).detail?.botId ?? null;
      void loadPreviewBot(botId);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === PREVIEW_STORAGE_KEY) {
        void loadPreviewBot(event.newValue);
      }
    }

    window.addEventListener(PREVIEW_CHANGED_EVENT, handlePreviewChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(PREVIEW_CHANGED_EVENT, handlePreviewChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadPreviewBot]);

  if (!bot) return null;

  return (
    <FloatingBotTester
      botId={bot.id}
      accentColor={bot.accentColor}
      label={bot.name}
    />
  );
}
