"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

interface FloatingBotTesterProps {
  botId: string;
  accentColor: string;
  label?: string;
}

const DEFAULT_ACCENT_COLOR = "#2563eb";

function validAccentColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_ACCENT_COLOR;
}

export default function FloatingBotTester({
  botId,
  accentColor,
  label = "Test bot",
}: FloatingBotTesterProps) {
  const [open, setOpen] = useState(false);
  const safeAccentColor = validAccentColor(accentColor);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6">
      <div
        className={
          open
            ? "mb-3 h-[min(560px,calc(100vh-7rem))] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
            : "pointer-events-none absolute bottom-20 right-0 h-px w-px overflow-hidden opacity-0"
        }
        aria-hidden={!open}
      >
        <iframe
          src={`/bots/${botId}/widget`}
          title="Bot tester"
          className="h-full w-full border-0"
        />
      </div>

      {!open && (
        <div className="mb-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-medium text-slate-600 shadow-sm">
          {label}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close bot tester" : "Open bot tester"}
        title={open ? "Close bot tester" : "Open bot tester"}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-[1.03] focus:outline-none focus:ring-4 focus:ring-blue-500/20"
        style={{ backgroundColor: safeAccentColor }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
