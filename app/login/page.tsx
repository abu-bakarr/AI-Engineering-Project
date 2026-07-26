"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, Bot, LockKeyhole, LogIn } from "lucide-react";

const demoAccounts = [
  { label: "Super Admin", email: "super@supportai.local" },
  { label: "Company Admin", email: "admin@acme.local" },
  { label: "Company User", email: "agent@acme.local" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@acme.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Login failed.");
      }
      router.push(data?.session?.needsOnboarding ? "/onboarding" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen w-[90%] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)]">
      <section className="relative overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={15} />
          Home
        </Link>

        <div className="flex min-h-[calc(100vh-120px)] items-center">
          <div className="max-w-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-slate-950">
              <Bot size={22} />
            </div>
            <h1 className="text-[42px] font-semibold leading-tight tracking-normal sm:text-[56px]">
              Secure access for support operations teams
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-slate-300">
              Sign in as a platform admin or a company user. Each request is
              checked for role, account status, and company access before it opens.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Role-based access", "Company-safe data", "Audit ready"].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <LockKeyhole size={16} className="mb-3 text-cyan-300" />
                  <p className="text-[13px] font-medium text-slate-100">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center bg-white px-4 py-8 text-slate-950 sm:px-8 lg:px-10">
        <div className="w-full">
          <div className="mb-8">
            <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-cyan-700">
              SupportAI Agent
            </p>
            <h2 className="mt-2 text-[28px] font-semibold">Login</h2>
            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              Demo password for seeded users: <span className="font-mono text-slate-700">Password123!</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={16} />
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-slate-500">
              Demo accounts
            </p>
            <div className="space-y-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setEmail(account.email)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-[13px] transition-colors hover:bg-cyan-50"
                >
                  <span className="font-medium text-slate-700">{account.label}</span>
                  <span className="truncate font-mono text-[12px] text-slate-500">
                    {account.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
