"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Building2,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessageCircle,
  Settings,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { UserRole } from "@/lib/types";

type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  roles?: UserRole[];
  section: "workspace" | "admin";
};

type Session = {
  name: string;
  email: string;
  role: UserRole;
  companyName: string | null;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", section: "workspace" },
  { label: "Inbox", icon: Inbox, href: "/inbox", section: "workspace" },
  { label: "Bots", icon: Bot, href: "/bots", section: "workspace" },
  {
    label: "Users",
    icon: UserCog,
    href: "/users",
    roles: ["super_admin", "company_admin"] as UserRole[],
    section: "admin",
  },
  {
    label: "Companies",
    icon: Building2,
    href: "/companies",
    roles: ["super_admin"] as UserRole[],
    section: "admin",
  },
  {
    label: "Activity",
    icon: ListChecks,
    href: "/activity",
    roles: ["super_admin", "company_admin"] as UserRole[],
    section: "admin",
  },
  { label: "Settings", icon: Settings, href: "/settings", section: "admin" },
];

function roleLabel(role?: UserRole | null) {
  if (role === "super_admin") return "Super Admin";
  if (role === "company_admin") return "Company Admin";
  return "Company User";
}

function initials(value?: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "S") + (parts[1]?.[0] ?? "A")).toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => !item.roles || (role && item.roles.includes(role))),
    [role],
  );
  const workspaceItems = visibleNavItems.filter(
    (item) => item.section === "workspace",
  );
  const adminItems = visibleNavItems.filter((item) => item.section === "admin");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setRole(data?.session?.role ?? null);
        setSession(data?.session ?? null);
      })
      .catch(() => {
        setRole(null);
        setSession(null);
      });
  }, []);

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/bots") {
      return pathname === "/bots" || pathname === "/bots/new" || /^\/bots\/[^/]+/.test(pathname);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderLink = ({ label, icon: Icon, href }: NavItem) => {
    const isActive = isActiveRoute(href);
    return (
      <Link
        key={label}
        href={href}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-150 ${
          isActive
            ? "bg-cyan-50 text-slate-950 ring-1 ring-cyan-200"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? "bg-cyan-600 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 group-hover:text-cyan-700"
          }`}
        >
          <Icon size={16} />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-screen w-[288px] shrink-0 border-r border-slate-200 bg-white text-slate-950 shadow-sm lg:flex lg:flex-col">
        <div className="h-1 bg-cyan-600" />
        <div className="border-b border-slate-200 px-5 py-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-slate-950">
                SupportAI Agent
              </p>
              <p className="truncate text-[12px] text-slate-500">
                AI support and live agents
              </p>
            </div>
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[13px] font-semibold text-cyan-700 ring-1 ring-slate-200">
                {initials(session?.companyName ?? session?.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-950">
                  {session?.companyName ?? "Platform operations"}
                </p>
                <p className="truncate text-[12px] text-slate-500">
                  {roleLabel(session?.role)}
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-6">
            <div>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Workspace
              </p>
              <div className="space-y-1">{workspaceItems.map(renderLink)}</div>
            </div>

            {adminItems.length > 0 && (
              <div>
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Administration
                </p>
                <div className="space-y-1">{adminItems.map(renderLink)}</div>
              </div>
            )}
          </nav>

          <div className="mt-auto pt-5">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-cyan-950">
                <ShieldCheck size={15} className="text-cyan-700" />
                Secure workspace
              </div>
              <p className="text-[12px] leading-5 text-cyan-900/70">
                Company data is scoped by role, plan, and tenant access.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <MessageCircle size={14} className="text-cyan-700" />
                Channels
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                <LifeBuoy size={14} className="text-cyan-700" />
                Support
              </div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-2xl shadow-slate-950/10 backdrop-blur lg:hidden">
        {visibleNavItems.slice(0, 4).map(({ label, icon: Icon, href }) => {
          const isActive = isActiveRoute(href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-colors duration-150 ${
                isActive
                  ? "bg-cyan-600 text-white"
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
