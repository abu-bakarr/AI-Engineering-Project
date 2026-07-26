"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

type SessionResponse = {
  session?: {
    name?: string;
    role?: UserRole;
    companyName?: string | null;
  } | null;
};

type TourStep = {
  icon: LucideIcon;
  title: string;
  copy: string;
  href: string;
  action: string;
};

const commonSteps: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: "Your dashboard at a glance",
    copy: "See the activity and performance that matter to your work. Company users see their company; super admins see the whole platform.",
    href: "/dashboard",
    action: "Open dashboard",
  },
  {
    icon: Inbox,
    title: "Work from the shared inbox",
    copy: "Bring website, WhatsApp, and Messenger conversations into one place. Search conversations, review history, and follow up with customers.",
    href: "/inbox",
    action: "Open shared inbox",
  },
  {
    icon: Bot,
    title: "Build and test your bots",
    copy: "Create assistants, add approved knowledge, and test answers before customers see them. Your bot list is always scoped to your access.",
    href: "/bots",
    action: "Open bots",
  },
];

const roleSteps: Record<UserRole, TourStep[]> = {
  company_user: [
    ...commonSteps,
    {
      icon: UserRound,
      title: "Keep your account up to date",
      copy: "Update your own profile and review your account details. Company-wide settings and user management stay with your administrators.",
      href: "/user",
      action: "Open my profile",
    },
  ],
  company_admin: [
    ...commonSteps,
    {
      icon: Users,
      title: "Manage your support team",
      copy: "Invite company users and admins, resend invitations, review activity, and manage access for your company only.",
      href: "/users",
      action: "Open team management",
    },
    {
      icon: ListChecks,
      title: "Review company activity",
      copy: "Follow important changes across users, bots, conversations, integrations, and subscriptions from one audit-ready timeline.",
      href: "/activity",
      action: "Open activity",
    },
    {
      icon: Settings,
      title: "Configure your company workspace",
      copy: "Manage your company profile, chat behavior, notifications, and eligible channel connections. Your plan controls which options are available.",
      href: "/settings",
      action: "Open settings",
    },
  ],
  super_admin: [
    ...commonSteps,
    {
      icon: Users,
      title: "Manage users across the platform",
      copy: "Review users across every company, manage invitations, and maintain role access from the platform administration view.",
      href: "/users",
      action: "Open all users",
    },
    {
      icon: Building2,
      title: "Oversee every company",
      copy: "Review company health, plans, usage, integrations, and activity. Platform visibility does not change the tenant boundaries used by company staff.",
      href: "/companies",
      action: "Open companies",
    },
    {
      icon: ListChecks,
      title: "Keep an audit trail",
      copy: "Inspect platform and company events so sensitive changes are easy to understand and follow up on.",
      href: "/activity",
      action: "Open activity",
    },
    {
      icon: Settings,
      title: "Control company and channel setup",
      copy: "Configure company profiles, plan entitlements, and WhatsApp or Facebook connection settings from the administration workspace.",
      href: "/settings",
      action: "Open settings",
    },
  ],
};

function roleLabel(role?: UserRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "company_admin") return "Company Admin";
  return "Company User";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState("there");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SessionResponse | null) => {
        const session = data?.session;
        setRole(session?.role ?? "company_user");
        setUserName(session?.name?.split(" ")[0] || "there");
        setCompanyName(session?.companyName ?? null);
      })
      .catch(() => {
        setRole("company_user");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const steps = useMemo(() => roleSteps[role ?? "company_user"], [role]);
  const step = steps[index] ?? steps[0];
  const Icon = step.icon;

  async function complete() {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/onboarding", { method: "POST" });
      if (!response.ok) {
        throw new Error("We could not save your tour status. Please try again.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the tour.");
      setIsSaving(false);
    }
  }

  function next() {
    if (index >= steps.length - 1) {
      void complete();
      return;
    }
    setIndex((value) => value + 1);
  }

  if (isLoading || !step) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 size={16} className="animate-spin text-cyan-600" />
          Preparing your workspace tour...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(8,145,178,0.10),transparent_38%)]" />
      <div className="animate-soft-enter relative w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/10">
        <div className="border-b border-slate-100 bg-slate-950 px-6 py-6 text-white sm:px-8">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
                Your first tour
              </p>
              <h1 className="mt-2 text-[25px] font-semibold tracking-normal">
                Welcome, {userName}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                We&apos;ll show you the parts of SupportAI that match your {roleLabel(role ?? undefined).toLowerCase()} access
                {companyName ? ` at ${companyName}` : ""}. This tour appears once, and you can skip it at any time.
              </p>
            </div>
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300 sm:flex">
              <ShieldCheck size={21} />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2" aria-label={`Tour step ${index + 1} of ${steps.length}`}>
            {steps.map((item, itemIndex) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setIndex(itemIndex)}
                aria-label={`Go to tour step ${itemIndex + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  itemIndex === index ? "w-10 bg-cyan-400" : "w-5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
            <span className="ml-auto text-[12px] text-slate-400">
              {index + 1} of {steps.length}
            </span>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:px-8 sm:py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 animate-gentle-pulse">
            <Icon size={28} />
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-cyan-700">
              Step {index + 1}
            </p>
            <h2 className="mt-2 text-[23px] font-semibold text-slate-950">{step.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{step.copy}</p>
            <Link
              href={step.href}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
            >
              {step.action}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 sm:mx-8">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => void complete()}
            disabled={isSaving}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-60"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={next}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : index === steps.length - 1 ? <CheckCircle2 size={15} /> : <ArrowRight size={15} />}
            {index === steps.length - 1 ? "Finish tour" : "Next feature"}
          </button>
        </div>
      </div>
    </div>
  );
}
