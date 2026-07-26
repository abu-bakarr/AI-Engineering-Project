import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

export default function BookDemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      <section className="mx-auto grid w-[90%] gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[13px] font-medium text-cyan-800">
            <CalendarDays size={14} />
            Demo request
          </div>
          <h1 className="text-[42px] font-semibold leading-tight tracking-normal sm:text-[56px]">
            See the platform with your support team in mind.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
            Walk through the workspace, ask questions, and see how AI chatbots,
            live agents, channels, billing, analytics, and admin controls fit together.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Company setup and user roles",
              "Bot creation and knowledge upload",
              "Inbox and live takeover",
              "Plans, permissions, and reporting",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <CheckCircle2 size={15} className="text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-[22px] font-semibold">Request a demo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This form is ready to connect to your CRM or calendar provider.
          </p>
          <form className="mt-6 space-y-3">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Full name" />
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Work email" />
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Company name" />
            <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" defaultValue="">
              <option value="" disabled>Team size</option>
              <option>1-10 agents</option>
              <option>11-50 agents</option>
              <option>51+ agents</option>
            </select>
            <textarea className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="What should we focus on?" />
            <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
              Open demo workspace
              <ArrowRight size={15} />
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
