import { Link } from "wouter";
import { Waves, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="animate-float mb-8">
        <Waves size={64} className="text-cyan-400/30 mx-auto" />
      </div>
      <h1
        className="text-8xl font-black ocean-gradient mb-4"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
        data-testid="not-found-title"
      >
        404
      </h1>
      <p className="text-blue-300/60 text-lg mb-8">Lost in the ocean...</p>
      <Link href="/">
        <button
          data-testid="btn-go-home"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-white font-semibold shadow-lg hover:opacity-90 transition-all cursor-pointer"
        >
          <Home size={16} />
          Back to Surface
        </button>
      </Link>
    </div>
  );
}
