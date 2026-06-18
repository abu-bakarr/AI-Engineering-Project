"use client";

import { Bot, Database } from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white lg:hidden">
          <Bot size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-slate-950">DocBot Admin</p>
          <p className="hidden text-[12px] text-slate-500 sm:block">
            Build, train, and embed document-backed assistants.
          </p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700">
        <Database size={13} />
        Admin
      </span>
    </header>
  );
}
