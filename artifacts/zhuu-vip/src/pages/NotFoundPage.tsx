import { Link } from "wouter";
import { Waves, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 text-center">
      <div className="animate-float mb-8">
        <Waves size={64} className="text-zinc-200/30 mx-auto" />
      </div>
      <h1
        className="text-8xl font-black zhuu-gradient mb-4"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
        data-testid="not-found-title"
      >
        404
      </h1>
      <p className="text-zinc-400/60 text-lg mb-8">Page not found</p>
      <Link href="/">
        <button
          data-testid="btn-go-home"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-white font-semibold shadow-lg hover:opacity-90 transition-all cursor-pointer"
        >
          <Home size={16} />
          Back to Surface
        </button>
      </Link>
    </div>
  );
}
