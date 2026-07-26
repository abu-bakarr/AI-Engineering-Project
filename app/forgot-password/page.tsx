"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import PublicNavbar from "@/components/PublicNavbar";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "code" | "password" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not send reset code.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Invalid confirmation code.");
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid confirmation code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password-reset/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not update password.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      <section className="mx-auto flex min-h-[calc(100vh-73px)] w-[90%] items-center justify-center py-10">
        <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)]">
          <div className="animate-soft-enter flex flex-col justify-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-600 text-white animate-gentle-pulse">
              <Mail size={22} />
            </div>
            <h1 className="text-[40px] font-semibold leading-tight tracking-normal sm:text-[54px]">
              Reset your password securely.
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-slate-600">
              We send a short-lived confirmation code to your email. After the
              server validates it, you can create a new password.
            </p>
          </div>

          <div className="animate-soft-enter rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
            {step === "email" && (
              <form onSubmit={requestCode} className="space-y-4">
                <h2 className="text-[22px] font-semibold">Find your account</h2>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Work email"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  required
                />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  Send code
                </button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={verifyCode} className="space-y-4">
                <h2 className="text-[22px] font-semibold">Enter confirmation code</h2>
                <p className="text-sm leading-6 text-slate-500">Check your email for a six-digit code.</p>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-[24px] font-semibold tracking-[0.25em] outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  required
                />
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  Verify code
                </button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={savePassword} className="space-y-4">
                <h2 className="text-[22px] font-semibold">Create a new password</h2>
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
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Save password
                </button>
              </form>
            )}

            {step === "done" && (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={38} />
                <h2 className="text-[22px] font-semibold">Password updated</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">You can now sign in with your new password.</p>
                <Link href="/login" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
                  Back to login
                </Link>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {error}
              </p>
            )}
            <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
              <ArrowLeft size={14} />
              Return to login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
