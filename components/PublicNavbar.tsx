import Link from "next/link";
import { Bot, CalendarDays } from "lucide-react";

const links = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Billing", href: "/billing" },
  { label: "Contact Us", href: "/contact" },
];

export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-[90%] items-center gap-4 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Bot size={20} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[15px] font-semibold text-slate-950">SupportAI Agent</p>
            <p className="truncate text-[12px] text-slate-500">AI support, live agents, one workspace</p>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/book-demo"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            <CalendarDays size={15} />
            Book a Demo
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
