import { SignUp } from "@clerk/react";
import { Waves } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div
      className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-12"
      data-testid="sign-up-page"
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,200,220,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header above card */}
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ background: "rgba(0,200,220,0.07)", border: "1px solid rgba(0,255,255,0.15)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 6px rgba(74,222,128,0.7)" }} />
          <span className="text-xs font-medium" style={{ color: "rgba(0,200,220,0.8)" }}>
            Join the Deep Ocean
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Waves size={20} className="text-cyan-400/50" />
          <span className="text-2xl font-bold gradient-text" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>
            ZhuuVIP
          </span>
        </div>
        <p className="text-sm" style={{ color: "rgba(0,200,220,0.45)" }}>
          One-click sign up with Google — fast and secure
        </p>
      </div>

      <div className="relative z-10 w-full">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/`}
        />
      </div>
    </div>
  );
}
