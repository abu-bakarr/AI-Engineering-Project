"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Database,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Bots", icon: Bot, href: "/bots" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/bots") {
      return pathname === "/bots" || pathname === "/bots/new" || /^\/bots\/[^/]+/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <aside className="hidden min-h-screen w-[272px] shrink-0 border-r border-slate-200 bg-slate-950 px-3 py-4 text-white lg:flex lg:flex-col">
        <div className="mb-6 flex items-center gap-3 px-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-950">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-5">DocBot Admin</p>
            <p className="text-[12px] text-slate-400">Knowledge assistants</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            Workspace
          </p>
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = isActiveRoute(href);
            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors duration-150 ${
                  isActive
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  size={17}
                  className={isActive ? "text-blue-600" : "text-slate-500"}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white">
              <Database size={15} className="text-blue-300" />
              RAG Chatbot Platform
            </div>
            <p className="text-[12px] leading-5 text-slate-400">
              Bots and documents sync through database-backed API routes.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-400">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-2">
              <ShieldCheck size={14} className="text-emerald-300" />
              Admin
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-2">
              <LifeBuoy size={14} className="text-slate-300" />
              v0.1.0
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-2xl shadow-slate-950/10 backdrop-blur lg:hidden">
        {navItems.map(({ label, icon: Icon, href }) => {
          const isActive = isActiveRoute(href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-colors duration-150 ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon
                size={16}
                className={isActive ? "text-white" : "text-slate-400"}
              />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
