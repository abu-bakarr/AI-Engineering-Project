"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

function InviteForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, temporaryPassword, newPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not activate account.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      <section className="mx-auto grid min-h-[calc(100vh-73px)] w-[90%] items-center gap-8 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.6fr)]">
        <div className="animate-soft-enter">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-600 text-white animate-gentle-pulse">
            <KeyRound size={22} />
          </div>
          <h1 className="max-w-3xl text-[42px] font-semibold leading-tight tracking-normal sm:text-[56px]">
            Choose your permanent password.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-slate-600">
            Use the temporary password from your invitation email once. After this
            step, sign in with your email and the new password you create here.
          </p>
        </div>

        <div className="animate-soft-enter rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={38} />
              <h2 className="text-[22px] font-semibold">Account ready</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your password was updated. Sign in to continue to onboarding.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
              >
                Go to login
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-[22px] font-semibold">Activate account</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Enter your temporary password, then create a new password.
                </p>
              </div>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                placeholder="Temporary password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                minLength={8}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm new password"
                minLength={8}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                required
              />
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Activate account
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
