import { Wrench, RefreshCw } from "lucide-react";

interface MaintenancePageProps {
  reason?: string;
}

export default function MaintenancePage({ reason }: MaintenancePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 relative z-10">
      <div className="w-full max-w-lg text-center">
        <div className="glass-card rounded-3xl p-8 border border-cyan-400/20">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <Wrench size={30} className="text-cyan-300" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Website Maintenance
          </h1>

          <p className="mt-3 text-blue-200/60">
            Website sedang dalam maintenance sementara.
          </p>

          {reason && (
            <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-sm text-blue-100/80">{reason}</p>
            </div>
          )}

          <p className="mt-6 text-xs text-blue-300/40">
            Silakan kembali lagi beberapa saat.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-sm hover:bg-cyan-400/20 transition-all"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
