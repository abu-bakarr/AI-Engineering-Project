import Link from "next/link";
import { ArrowRight, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      <section className="mx-auto grid w-[90%] gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h1 className="text-[42px] font-semibold leading-tight tracking-normal sm:text-[56px]">
            Talk to us about your support workflow.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
            Share how your team handles customer conversations today. We will help
            map the right setup for bots, agents, channels, billing, and reporting.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: Mail, label: "Email", value: "support@example.com" },
              { icon: Phone, label: "Phone", value: "Available by appointment" },
              { icon: MapPin, label: "Region", value: "Remote-first support" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <Icon size={18} className="text-cyan-700" />
                <p className="mt-3 text-[12px] uppercase tracking-[0.06em] text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <MessageSquare size={22} className="text-cyan-700" />
          <h2 className="mt-4 text-[22px] font-semibold">Send a message</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The demo does not send email yet, but this page is ready for a contact
            provider or CRM workflow.
          </p>
          <form className="mt-6 space-y-3">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Name" />
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Work email" />
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="Company" />
            <textarea className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20" placeholder="What would you like to improve?" />
            <Link href="/book-demo" className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
              Book a Demo
              <ArrowRight size={15} />
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
