import Link from "next/link";
import { ArrowRight, CheckCircle2, Minus } from "lucide-react";
import { PLAN_DEFINITIONS, PLAN_FEATURES, FeatureId } from "@/lib/plans";
import PublicNavbar from "@/components/PublicNavbar";

const featureRows: Array<{ id: FeatureId; label: string }> = [
  { id: "website_chatbot", label: "Website chatbot" },
  { id: "bot_management", label: "Bot creation and management" },
  { id: "knowledge_base", label: "Knowledge-base upload" },
  { id: "whatsapp", label: "WhatsApp integration" },
  { id: "facebook", label: "Facebook Messenger integration" },
  { id: "human_takeover", label: "Live-agent takeover" },
  { id: "advanced_analytics", label: "Advanced analytics dashboards" },
  { id: "routing_escalation", label: "Routing and escalation rules" },
  { id: "ai_quality_management", label: "AI quality management" },
  { id: "sla_management", label: "SLA management" },
  { id: "custom_roles_approvals", label: "Custom roles and approvals" },
  { id: "security_audit_center", label: "Security and audit center" },
];

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />

      <section className="mx-auto w-[90%] py-14">
        <div className="mb-10 max-w-3xl">
          <h1 className="text-[42px] font-semibold leading-tight tracking-normal">Billing plans</h1>
          <p className="mt-3 text-[16px] leading-7 text-slate-600">
            Choose the level that matches your support team today. Prices can be connected to your billing provider when you are ready.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_DEFINITIONS.map((plan) => {
            const Icon = plan.icon;
            return (
            <article key={plan.id} className="flex rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex min-h-[420px] flex-1 flex-col">
                <Icon size={24} className="text-cyan-700" />
                <h2 className="mt-5 text-[22px] font-semibold">{plan.name}</h2>
                <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{plan.summary}</p>
                <p className="mt-5 text-[30px] font-semibold">{plan.price}</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {plan.price === "Custom" ? "Talk to sales" : "Example monthly plan"}
                </p>
                <div className="mt-5 space-y-2">
                  {plan.includes.slice(0, 7).map((feature) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      {feature}
                    </div>
                  ))}
                </div>
                <Link href="/book-demo" className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
                  Book a Demo
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          );
          })}
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(120px,1fr))] border-b border-slate-200 bg-slate-50 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            <div className="px-4 py-3">Feature</div>
            {PLAN_DEFINITIONS.map((plan) => (
              <div key={plan.id} className="px-4 py-3">{plan.name}</div>
            ))}
          </div>
          {featureRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(120px,1fr))] border-b border-slate-100 text-sm last:border-b-0">
              <div className="px-4 py-3 font-medium text-slate-800">{row.label}</div>
              {PLAN_DEFINITIONS.map((plan) => {
                const available = PLAN_FEATURES[plan.id].includes(row.id);
                return (
                  <div key={plan.id} className="px-4 py-3">
                    {available ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Minus size={17} className="text-slate-300" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
