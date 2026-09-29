import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Sparkles,
  X,
} from "lucide-react";

type AlertType = "success" | "error" | "warning" | "info";

type AlertState = {
  open: boolean;
  message: string;
  type: AlertType;
  mode: "alert" | "confirm";
  resolve?: (value: boolean) => void;
};

declare global {
  interface Window {
    zhuuConfirm: (message?: unknown) => Promise<boolean>;
  }
}

const getType = (message: string): AlertType => {
  const text = message.toLowerCase();

  if (
    text.includes("berhasil") ||
    text.includes("sukses") ||
    text.includes("success") ||
    text.includes("selesai")
  ) {
    return "success";
  }

  if (
    text.includes("gagal") ||
    text.includes("error") ||
    text.includes("salah") ||
    text.includes("tidak") ||
    text.includes("habis")
  ) {
    return "error";
  }

  if (
    text.includes("wajib") ||
    text.includes("peringatan") ||
    text.includes("limit") ||
    text.includes("yakin")
  ) {
    return "warning";
  }

  return "info";
};

const config = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-300",
    iconBg: "bg-emerald-400/[.08]",
    glow: "shadow-[0_0_80px_rgba(16,185,129,.16)]",
    label: "Berhasil",
    accent: "from-emerald-300/0 via-emerald-300/70 to-emerald-300/0",
  },
  error: {
    icon: XCircle,
    iconClass: "text-rose-300",
    iconBg: "bg-rose-400/[.08]",
    glow: "shadow-[0_0_80px_rgba(244,63,94,.16)]",
    label: "Terjadi Kesalahan",
    accent: "from-rose-300/0 via-rose-300/70 to-rose-300/0",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-300",
    iconBg: "bg-amber-400/[.08]",
    glow: "shadow-[0_0_80px_rgba(245,158,11,.16)]",
    label: "Perhatian",
    accent: "from-amber-300/0 via-amber-300/70 to-amber-300/0",
  },
  info: {
    icon: Info,
    iconClass: "text-cyan-300",
    iconBg: "bg-cyan-400/[.08]",
    glow: "shadow-[0_0_80px_rgba(34,211,238,.16)]",
    label: "Informasi",
    accent: "from-cyan-300/0 via-cyan-300/70 to-cyan-300/0",
  },
};

export default function ZhuuAlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    message: "",
    type: "info",
    mode: "alert",
  });

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message?: unknown) => {
      const text = String(message ?? "");

      setAlert({
        open: true,
        message: text,
        type: getType(text),
        mode: "alert",
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    window.zhuuConfirm = (message?: unknown) => {
      const text = String(message ?? "");

      return new Promise<boolean>((resolve) => {
        setAlert({
          open: true,
          message: text,
          type: "warning",
          mode: "confirm",
          resolve,
        });
      });
    };

    return () => {
    };
  }, []);

  useEffect(() => {
    if (!alert.open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAlert((current) => {
          current.resolve?.(false);
          return {
            ...current,
            open: false,
            resolve: undefined,
          };
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [alert.open]);

  const current = config[alert.type];
  const Icon = current.icon;

  return (
    <>
      {children}

      {alert.open && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-label="ZhuuSite notification"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#01050c]/80 backdrop-blur-[18px] animate-[zh-alert-backdrop_.25s_ease-out]" />

          {/* Ambient glow */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 size-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[.055] blur-[90px]" />

          {/* iOS-style card */}
          <div
            className={[
              "relative w-full max-w-[390px] overflow-hidden",
              "rounded-[30px]",
              "border border-white/[.11]",
              "bg-[#07111f]/[.94]",
              "backdrop-blur-[32px]",
              current.glow,
              "animate-[zh-alert-in_.38s_cubic-bezier(.16,1,.3,1)]",
            ].join(" ")}
          >
            {/* Top reflection */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-white/[.055] to-transparent" />

            {/* Top cyan line */}
            <div
              className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r ${current.accent}`}
            />

            {/* Tiny brand indicator */}
            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5">
              <Sparkles className="size-3 text-cyan-300/60" />
              <span className="text-[9px] font-bold tracking-[.22em] text-cyan-100/35">
                ZHUU
              </span>
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={() =>
                setAlert((current) => {
                  current.resolve?.(false);
                  return {
                    ...current,
                    open: false,
                    resolve: undefined,
                  };
                })
              }
              className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-white/[.06] bg-white/[.045] text-white/35 transition-all duration-200 hover:bg-white/[.09] hover:text-white/80 active:scale-90"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </button>

            <div className="relative px-6 pb-5 pt-12 text-center">
              {/* Icon */}
              <div
                className={[
                  "relative mx-auto flex size-[72px] items-center justify-center",
                  "rounded-[23px]",
                  "border border-white/[.09]",
                  current.iconBg,
                  "shadow-inner shadow-white/[.06]",
                  "animate-[zh-alert-icon_.55s_cubic-bezier(.16,1,.3,1)]",
                ].join(" ")}
              >
                <div className="absolute inset-0 rounded-[23px] bg-white/[.025]" />

                <div className="absolute inset-2 rounded-[18px] border border-white/[.04]" />

                <Icon
                  className={`relative size-8 ${current.iconClass} drop-shadow-[0_0_14px_currentColor]`}
                  strokeWidth={1.8}
                />
              </div>

              {/* Brand */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <h3 className="text-[20px] font-bold tracking-[-.025em] text-white">
                  ZhuuSite
                </h3>

                <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2 py-0.5 text-[8px] font-bold tracking-[.14em] text-cyan-200/55">
                  VIP
                </span>
              </div>

              {/* Status */}
              <div className="mt-1 text-[11px] font-medium tracking-wide text-white/30">
                {current.label}
              </div>

              {/* Message */}
              <div className="mx-auto mt-4 max-h-[240px] overflow-y-auto px-2 text-[14px] leading-[1.65] text-white/65 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {alert.message}
              </div>
            </div>

            {/* Bottom action */}
            <div className="border-t border-white/[.07] bg-white/[.025] p-3">
              {alert.mode === "confirm" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAlert((current) => {
                        current.resolve?.(false);
                        return {
                          ...current,
                          open: false,
                          resolve: undefined,
                        };
                      })
                    }
                    className="rounded-[18px] border border-white/[.08] bg-white/[.045] py-3.5 text-[14px] font-semibold text-white/55 transition-all hover:bg-white/[.08] hover:text-white active:scale-[.975]"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    autoFocus
                    onClick={() =>
                      setAlert((current) => {
                        current.resolve?.(true);
                        return {
                          ...current,
                          open: false,
                          resolve: undefined,
                        };
                      })
                    }
                    className="rounded-[18px] border border-cyan-300/[.16] bg-cyan-300/[.07] py-3.5 text-[14px] font-bold text-cyan-200 transition-all hover:bg-cyan-300/[.11] active:scale-[.975]"
                  >
                    Lanjut
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={() =>
                    setAlert((current) => ({
                      ...current,
                      open: false,
                    }))
                  }
                  className="group relative w-full overflow-hidden rounded-[18px] border border-cyan-300/[.12] bg-cyan-300/[.055] py-3.5 text-[15px] font-bold text-cyan-200 transition-all duration-200 hover:border-cyan-300/20 hover:bg-cyan-300/[.09] active:scale-[.975]"
                >
                  <span className="relative z-10">Oke</span>

                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </div>

            {/* Bottom reflection */}
            <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </div>
      )}

      <style>{`
        @keyframes zh-alert-backdrop {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes zh-alert-in {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(.92);
            filter: blur(4px);
          }

          60% {
            opacity: 1;
            transform: translateY(-2px) scale(1.015);
            filter: blur(0);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes zh-alert-icon {
          0% {
            opacity: 0;
            transform: scale(.65) rotate(-8deg);
          }

          70% {
            opacity: 1;
            transform: scale(1.08) rotate(2deg);
          }

          100% {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }
      `}</style>
    </>
  );
}
