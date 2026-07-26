"use client";

import { useEffect, useState } from "react";
import { Bot, LogOut, ShieldCheck } from "lucide-react";
import { UserRole } from "@/lib/types";

type Session = {
  name: string;
  email: string;
  role: UserRole;
  companyName: string | null;
};

function roleLabel(role?: UserRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "company_admin") return "Company Admin";
  return "Company User";
}

export default function Topbar() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setSession(data?.session ?? null))
      .catch(() => setSession(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white lg:hidden">
          <Bot size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-slate-950">
            AI-Powered Agent
          </p>
          <p className="hidden text-[12px] text-slate-500 sm:block">
            {session?.companyName ?? "Platform operations"} · {roleLabel(session?.role)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-700 sm:inline-flex">
          <ShieldCheck size={13} />
          {session ? roleLabel(session.role) : "Secure"}
        </span>
        <button
          type="button"
          onClick={logout}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
          title="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
