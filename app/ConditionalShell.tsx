"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import PersistentBotTester from "@/components/PersistentBotTester";
import FirstLoginPasswordModal from "@/components/FirstLoginPasswordModal";

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWidget = /\/bots\/[^/]+\/widget(\/|$)/.test(pathname ?? "");
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/billing" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/book-demo" ||
    pathname === "/invite" ||
    pathname === "/forgot-password";
  const [isCheckingSession, setIsCheckingSession] = useState(!isWidget && !isPublic);

  useEffect(() => {
    if (isWidget || isPublic) {
      setIsCheckingSession(false);
      return;
    }

    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => {
      if (cancelled) return;
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      setIsCheckingSession(false);
    }).catch(() => {
      if (!cancelled) window.location.href = "/login";
    });

    return () => {
      cancelled = true;
    };
  }, [isPublic, isWidget, pathname]);

  if (isWidget || isPublic) {
    return <>{children}</>;
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          Checking secure session...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 lg:pl-[288px]">
      <Sidebar />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto pb-24 lg:pb-0">
          {children}
        </main>
      </div>
      <FirstLoginPasswordModal />
      <PersistentBotTester />
    </div>
  );
}
