"use client";

import { usePathname } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import PersistentBotTester from "@/components/PersistentBotTester";

export default function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWidget = /\/bots\/[^/]+\/widget(\/|$)/.test(pathname ?? "");

  if (isWidget) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      </div>
      <PersistentBotTester />
    </div>
  );
}
