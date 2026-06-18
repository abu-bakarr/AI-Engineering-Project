import { BarChart3 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          Reporting and workspace analytics will appear here.
        </p>
      </div>

      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <BarChart3 size={22} />
          </div>
          <p className="text-[15px] font-semibold text-slate-900">Coming soon</p>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            This screen is reserved for usage metrics, bot performance, and platform health.
          </p>
        </div>
      </div>
    </div>
  );
}
