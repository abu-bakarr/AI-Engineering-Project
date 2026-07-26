import { Bot, Headphones, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

const sections = [
  {
    icon: Bot,
    title: "AI handles the first response",
    copy: "Customers get quick answers from approved company knowledge instead of waiting for a queue to move.",
  },
  {
    icon: Headphones,
    title: "Agents stay in control",
    copy: "When a question needs judgment, an agent can join, pause the AI, and continue the conversation with full context.",
  },
  {
    icon: LockKeyhole,
    title: "Company data stays separate",
    copy: "Every company has its own users, bots, conversations, settings, integrations, and activity history.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto w-[90%]">
        <div className="max-w-4xl">
          <h1 className="text-[42px] font-semibold leading-tight tracking-normal sm:text-[56px]">
            Built for support teams that want AI speed and human judgment.
          </h1>
          <p className="mt-5 text-[16px] leading-7 text-slate-600">
            SupportAI Agent helps companies answer common questions quickly,
            move complex issues to people, and manage the whole support operation
            from one secure workspace.
          </p>
        </div>
        </div>
      </section>

      <section className="mx-auto grid w-[90%] gap-4 py-12 lg:grid-cols-3">
        {sections.map(({ icon: Icon, title, copy }) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <Icon size={22} className="text-cyan-700" />
            <h2 className="mt-5 text-[20px] font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
          </article>
        ))}
      </section>

      <section className="bg-slate-950 py-14 text-white">
        <div className="mx-auto grid w-[90%] gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-[30px] font-semibold">What the platform covers</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-300">
              It brings together the daily tools support teams need: bots, inbox,
              users, company administration, billing plans, activity logs, analytics,
              and channel setup.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Website chatbots",
              "WhatsApp and Messenger foundations",
              "Live-agent takeover",
              "Company-level administration",
              "Subscription entitlements",
              "Security and audit history",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-3 text-sm">
                <ShieldCheck size={15} className="text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-[90%] py-14">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <MessageCircle size={22} className="text-cyan-700" />
          <h2 className="mt-4 text-[24px] font-semibold">A better handoff between AI and people</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
            The goal is simple: let AI answer the questions it can handle, and make
            it easy for a person to step in when a customer needs care, judgment,
            or follow-through.
          </p>
        </div>
      </section>
    </main>
  );
}
