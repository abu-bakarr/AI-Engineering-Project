import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Headphones,
  Inbox,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

const highlights = [
  { label: "One inbox", value: "Web, WhatsApp, Messenger" },
  { label: "Live takeover", value: "Pause AI when people step in" },
  { label: "Secure workspaces", value: "Company data stays separate" },
  { label: "Admin control", value: "Plans, users, bots, and audit history" },
];

const features = [
  {
    icon: Inbox,
    title: "A shared inbox for every channel",
    copy: "Keep website chats, WhatsApp messages, and Messenger conversations in one place so agents do not jump between tools.",
  },
  {
    icon: Bot,
    title: "AI that answers from your knowledge",
    copy: "Bots use company documents and return grounded answers. When confidence drops, the conversation can move to a person.",
  },
  {
    icon: Headphones,
    title: "Human takeover when it matters",
    copy: "Agents can join a live chat, pause the AI, add notes, assign ownership, and hand the conversation back when ready.",
  },
  {
    icon: BarChart3,
    title: "Reports leaders can act on",
    copy: "Track volume, response time, resolution rate, handoff rate, channel performance, and content gaps.",
  },
  {
    icon: ShieldCheck,
    title: "Built for company-level isolation",
    copy: "Each company has its own users, bots, conversations, integrations, settings, subscriptions, and activity logs.",
  },
  {
    icon: LockKeyhole,
    title: "Admin tools without guesswork",
    copy: "Super Admins can manage the platform. Company Admins manage only their own workspace.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />

      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-x-0 top-0 h-1 bg-cyan-600" />
        <div className="mx-auto grid min-h-[calc(100vh-73px)] w-[90%] gap-10 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
          <div className="flex max-w-4xl flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[13px] font-medium text-cyan-800">
              <Sparkles size={14} />
              AI support that your team can safely take over
            </div>
            <h1 className="text-[42px] font-semibold leading-tight tracking-normal text-slate-950 sm:text-[58px] lg:text-[72px]">
              Support customers faster without losing the human touch.
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
              SupportAI Agent gives every company its own secure workspace for AI
              chatbots, live agents, customer conversations, channel integrations,
              billing, analytics, and admin controls.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book-demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Book a Demo
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/billing"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                View plans
              </Link>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-2xl shadow-cyan-950/20">
              <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">Live support workspace</p>
                    <p className="text-[12px] text-slate-400">Acme Support · Growth plan</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[12px] font-medium text-emerald-300">
                    Online
                  </span>
                </div>
              </div>
              <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="hidden border-r border-white/10 bg-white/[0.03] p-3 lg:block">
                  {["Inbox", "Bots", "Users", "Analytics", "Settings"].map((item, index) => (
                    <div
                      key={item}
                      className={`mb-1 rounded-lg px-3 py-2 text-[13px] ${
                        index === 0 ? "bg-white text-slate-950" : "text-slate-400"
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </aside>
                <div className="p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Open chats", "24"],
                      ["AI resolved", "71%"],
                      ["Avg. reply", "1.8s"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white p-3">
                        <p className="text-[12px] text-slate-500">{label}</p>
                        <p className="mt-2 text-[24px] font-semibold text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold">Customer conversation</p>
                        <p className="text-[12px] text-slate-500">WhatsApp · Billing question</p>
                      </div>
                      <MessageCircle size={17} className="text-cyan-700" />
                    </div>
                    <div className="space-y-3 text-[13px] leading-5">
                      <div className="max-w-[80%] rounded-lg bg-slate-50 p-3 text-slate-700">
                        Can I change my plan before the renewal date?
                      </div>
                      <div className="ml-auto max-w-[84%] rounded-lg bg-cyan-600 p-3 text-white">
                        Yes. I can help with the steps, or I can bring in a billing specialist.
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                        Agent joined. AI paused while Sam handles the conversation.
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {["Suggested reply ready", "Customer profile updated"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-lg bg-white p-3 text-[13px] text-slate-700">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-[90%] py-12">
        <div className="grid gap-3 md:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[12px] uppercase tracking-[0.06em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-[16px] font-semibold text-slate-950">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto w-[90%]">
        <div className="mb-8 max-w-3xl">
          <h2 className="text-[34px] font-semibold tracking-normal">Everything your support team needs in one workspace.</h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Start with a website bot. Add WhatsApp and Messenger when the team is ready.
            Bring in agents for complex conversations and keep a clear audit trail.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-cyan-700 ring-1 ring-slate-200">
                <Icon size={20} />
              </div>
              <h3 className="text-[17px] font-semibold">{title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section className="mx-auto grid w-[90%] gap-0 bg-slate-950 text-white lg:grid-cols-3">
        {[
          {
            title: "Starter",
            copy: "For teams that need a secure website bot and basic analytics.",
          },
          {
            title: "Growth",
            copy: "For teams adding WhatsApp, Messenger, live monitoring, and agent takeover.",
          },
          {
            title: "Enterprise",
            copy: "For organizations that need quality reviews, SLA tracking, approvals, and deeper controls.",
          },
        ].map((plan) => (
          <div key={plan.title} className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
            <h3 className="text-[24px] font-semibold">{plan.title}</h3>
            <p className="mt-3 text-[15px] leading-7 text-slate-300">{plan.copy}</p>
            <Link href="/billing" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">
              Compare plans
              <ArrowRight size={15} />
            </Link>
          </div>
        ))}
      </section>

      <section className="mx-auto w-[90%] py-16">
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <h2 className="text-[30px] font-semibold tracking-normal">See how it fits your support flow.</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              We can walk through company setup, bot creation, live takeover, channel
              routing, subscription controls, and reporting using the demo workspace.
            </p>
          </div>
          <Link
            href="/book-demo"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700 md:mt-0"
          >
            Book a Demo
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
