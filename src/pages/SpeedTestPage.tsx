import { useState, useCallback, useRef } from "react";

interface TestResult { download: number; upload: number; ping: number; jitter: number; timestamp: Date; }
type Phase = "idle" | "ping" | "download" | "upload" | "done";

function SpeedGauge({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const pct = Math.min(value / max, 1);
  const r = 70;
  const circ = 2 * Math.PI * r;
  const startAngle = 225;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 180, height: 140 }}>
        <svg width={180} height={160} viewBox="0 0 180 160" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle cx={90} cy={100} r={r} fill="none" stroke="rgba(0,200,220,0.08)" strokeWidth={12}
            strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
            strokeDashoffset={circ * 0.125}
            strokeLinecap="round"
            transform={`rotate(${startAngle - 270} 90 100)`} />
          <circle cx={90} cy={100} r={r} fill="none" stroke={`url(#grad-${label})`} strokeWidth={12}
            strokeDasharray={`${circ * 0.75 * pct} ${circ - circ * 0.75 * pct}`}
            strokeDashoffset={circ * 0.125}
            strokeLinecap="round"
            transform={`rotate(${startAngle - 270} 90 100)`}
            style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 0.3s ease" }} />
          <text x="90" y="90" textAnchor="middle" fill={color} fontSize="26" fontWeight="800" fontFamily="Poppins, Inter, sans-serif"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
            {value < 1 ? value.toFixed(0) : value >= 100 ? Math.round(value) : value.toFixed(1)}
          </text>
          <text x="90" y="112" textAnchor="middle" fill="rgba(0,200,220,0.5)" fontSize="12" fontFamily="Inter, sans-serif">{unit}</text>
        </svg>
      </div>
      <div className="font-semibold text-sm" style={{ color: "rgba(0,200,220,0.7)", fontFamily: "Poppins, Inter, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

async function measurePing(): Promise<{ ping: number; jitter: number }> {
  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    try { await fetch("/api/healthz", { cache: "no-store" }); } catch { }
    pings.push(performance.now() - start);
    await new Promise(r => setTimeout(r, 100));
  }
  pings.sort((a, b) => a - b);
  const trimmed = pings.slice(1, -1);
  const avg = trimmed.reduce((a, b) => a + b) / trimmed.length;
  const jitter = trimmed.reduce((sum, p) => sum + Math.abs(p - avg), 0) / trimmed.length;
  return { ping: Math.round(avg), jitter: Math.round(jitter) };
}

async function measureSpeed(type: "download" | "upload", onProgress: (mbps: number) => void): Promise<number> {
  const SIZE = 5 * 1024 * 1024;
  const DURATION = 8000;
  const PARALLEL = 4;
  const start = performance.now();
  let totalBytes = 0;
  let done = false;

  const updateInterval = setInterval(() => {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed > 0) onProgress((totalBytes * 8) / elapsed / 1_000_000);
  }, 200);

  const workers = Array.from({ length: PARALLEL }, async () => {
    while (!done && performance.now() - start < DURATION) {
      try {
        if (type === "download") {
          const res = await fetch(`https://httpbin.org/bytes/${SIZE}?t=${Date.now()}`, { cache: "no-store" });
          if (!res.body) continue;
          const reader = res.body.getReader();
          while (!done) {
            const { done: d, value } = await reader.read();
            if (d) break;
            totalBytes += value?.length || 0;
          }
        } else {
          const data = new Uint8Array(SIZE);
          const t0 = performance.now();
          await fetch("https://httpbin.org/post", { method: "POST", body: data, cache: "no-store" }).catch(() => null);
          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed > 0) totalBytes += SIZE;
        }
      } catch { await new Promise(r => setTimeout(r, 500)); }
    }
  });

  setTimeout(() => { done = true; }, DURATION);
  await Promise.all(workers);
  clearInterval(updateInterval);
  done = true;

  const elapsed = Math.min((performance.now() - start) / 1000, DURATION / 1000);
  return Math.max((totalBytes * 8) / elapsed / 1_000_000, 0);
}

export default function SpeedTestPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pingMs, setPingMs] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [download, setDownload] = useState(0);
  const [upload, setUpload] = useState(0);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const runTest = useCallback(async () => {
    if (phase !== "idle" && phase !== "done") return;
    cancelRef.current = false;
    setPhase("ping"); setProgress(0); setDownload(0); setUpload(0); setPingMs(0); setJitter(0);

    try {
      const { ping, jitter: j } = await measurePing();
      setPingMs(ping); setJitter(j); setProgress(20);
      if (cancelRef.current) return;

      setPhase("download");
      const dl = await measureSpeed("download", (v) => { setDownload(v); setProgress(20 + (v / 200) * 40); });
      setDownload(dl); setProgress(60);
      if (cancelRef.current) return;

      setPhase("upload");
      const ul = await measureSpeed("upload", (v) => { setUpload(v); setProgress(60 + (v / 100) * 40); });
      setUpload(ul); setProgress(100);

      const result: TestResult = { download: dl, upload: ul, ping, jitter: j, timestamp: new Date() };
      setHistory(prev => [result, ...prev.slice(0, 4)]);
      setPhase("done");
    } catch { setPhase("done"); }
  }, [phase]);

  const reset = () => { cancelRef.current = true; setPhase("idle"); setProgress(0); setDownload(0); setUpload(0); setPingMs(0); setJitter(0); };

  const phaseLabel: Record<Phase, string> = {
    idle: "", ping: "Measuring latency…", download: "Testing download speed…", upload: "Testing upload speed…", done: "Test complete! ✓",
  };

  return (
    <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-4xl mb-3">⚡</div>
          <h1 className="text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Speed Test</h1>
          <p style={{ color: "rgba(0,200,220,0.5)" }}>Measure your internet connection speed</p>
        </div>

        <div className="glass-card p-8 mb-6 rounded-2xl">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <SpeedGauge value={download} max={500} label="Download" unit="Mbps" color="#00ffff" />
            <SpeedGauge value={upload} max={250} label="Upload" unit="Mbps" color="#34d399" />
            <SpeedGauge value={pingMs} max={200} label="Ping" unit="ms" color="#f9a8d4" />
          </div>

          {phase !== "idle" && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm" style={{ color: "rgba(0,200,220,0.6)" }}>{phaseLabel[phase]}</span>
                <span className="text-sm font-bold" style={{ color: "#00ffff" }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 4, background: "rgba(0,200,220,0.1)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #00b4d8, #00ffff)", borderRadius: 2, transition: "width 0.3s ease", boxShadow: "0 0 8px rgba(0,255,255,0.6)" }} />
              </div>
            </div>
          )}

          {jitter > 0 && (
            <div className="flex justify-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-xl font-bold" style={{ color: "#fbbf24" }}>{jitter} ms</div>
                <div className="text-xs" style={{ color: "rgba(0,200,220,0.5)" }}>Jitter</div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4">
            {(phase === "idle" || phase === "done") && (
              <button onClick={runTest} className="neon-btn-solid px-10 py-4 rounded-full font-bold text-base">
                {phase === "done" ? "▶ Run Again" : "▶ Start Test"}
              </button>
            )}
            {phase !== "idle" && phase !== "done" && (
              <button onClick={reset} className="neon-btn px-8 py-4 rounded-full font-bold text-base">
                ■ Stop Test
              </button>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-bold text-lg mb-4 gradient-text" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Recent Tests</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,255,255,0.1)" }}>
                    {["Time", "↓ Download", "↑ Upload", "Ping", "Jitter"].map(h => (
                      <th key={h} className="pb-3 text-left font-semibold" style={{ color: "rgba(0,200,220,0.5)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="history-row" style={{ borderBottom: "1px solid rgba(0,255,255,0.05)" }}>
                      <td className="py-3 pr-4" style={{ color: "rgba(0,200,220,0.5)", fontSize: 12 }}>
                        {r.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 pr-4 font-bold" style={{ color: "#00ffff" }}>{r.download.toFixed(1)} Mbps</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: "#34d399" }}>{r.upload.toFixed(1)} Mbps</td>
                      <td className="py-3 pr-4 font-bold" style={{ color: "#f9a8d4" }}>{r.ping} ms</td>
                      <td className="py-3 font-bold" style={{ color: "#fbbf24" }}>{r.jitter} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
