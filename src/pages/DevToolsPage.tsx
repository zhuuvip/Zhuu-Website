import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import { Copy, Download, RefreshCw, Check, Shuffle, Gauge } from "lucide-react";
import { useAuth } from "@clerk/react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

function CopyBtn({ text, className = "" }: { text: string; className?: string }) {
  const { copied, copy } = useCopy();
  return (
    <button
      onClick={() => copy(text)}
      title="Copy to clipboard"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${className}`}
      style={{
        background: copied ? "rgba(0,220,100,0.15)" : "rgba(0,200,220,0.1)",
        border: copied ? "1px solid rgba(0,220,100,0.4)" : "1px solid rgba(0,200,220,0.25)",
        color: copied ? "#4ade80" : "rgba(0,200,220,0.9)",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface DailyUsage {
  used: number;
  remaining: number;
  limit: number;
}

function DailyLimitBar({ usage }: { usage: DailyUsage }) {
  const percent =
    usage.limit > 0
      ? Math.max(0, Math.min(100, (usage.remaining / usage.limit) * 100))
      : 0;

  const empty = usage.remaining <= 0;
  const low = percent <= 20;

  return (
    <div
      className="w-full max-w-sm rounded-xl px-3 py-2.5"
      style={{
        background: empty
          ? "rgba(248,113,113,0.08)"
          : low
            ? "rgba(251,191,36,0.08)"
            : "rgba(0,200,220,0.06)",
        border: `1px solid ${
          empty
            ? "rgba(248,113,113,0.22)"
            : low
              ? "rgba(251,191,36,0.22)"
              : "rgba(0,200,220,0.14)"
        }`,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{
            color: empty ? "#fca5a5" : low ? "#fcd34d" : "#67e8f9",
          }}
        >
          <Gauge size={13} />
          <span>Limit hari ini</span>
        </div>

        <span
          className="text-[11px] font-semibold"
          style={{
            color: empty
              ? "#fca5a5"
              : low
                ? "#fcd34d"
                : "rgba(200,240,255,0.75)",
          }}
        >
          {usage.remaining} / {usage.limit}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.07)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            background: empty
              ? "#f87171"
              : low
                ? "#fbbf24"
                : "linear-gradient(90deg, #22d3ee, #8b5cf6)",
          }}
        />
      </div>

      <div
        className="mt-1 text-[9px]"
        style={{ color: "rgba(160,210,230,0.42)" }}
      >
        {empty
          ? "Batas harian habis — coba lagi besok."
          : `${usage.used} penggunaan terpakai`}
      </div>
    </div>
  );
}

function ToolCard({
  icon, name, desc, active, locked, uses, avgRating, onClick,
}: {
  icon: React.ReactNode; name: string; desc: string; active: boolean; locked?: boolean; uses?: number; avgRating?: number | null; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl transition-all duration-200 cursor-pointer relative"
      style={{
        background: active ? "rgba(0,200,220,0.1)" : "rgba(0,20,40,0.45)",
        border: active ? "1.5px solid rgba(0,200,220,0.5)" : "1px solid rgba(0,200,220,0.12)",
        boxShadow: active ? "0 0 16px rgba(0,200,220,0.12)" : "none",
      }}
    >
      {locked && (
        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(192,132,252,0.15)", color: "#c084fc" }}>🔒 VIP</span>
      )}
      <div className="text-2xl mb-2 font-mono font-bold" style={{ color: active ? "#00e5ff" : "rgba(0,200,220,0.6)" }}>
        {icon}
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: active ? "#00e5ff" : "rgba(200,240,255,0.8)" }}>
        {name}
      </div>
      <div className="text-xs mb-2" style={{ color: "rgba(0,200,220,0.45)" }}>{desc}</div>
      {(!!uses || !!avgRating) && (
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "rgba(0,200,220,0.4)" }}>
          {!!uses && <span>🔥 {uses.toLocaleString("id-ID")}x</span>}
          {!!avgRating && <span>★ {avgRating.toFixed(1)}</span>}
        </div>
      )}
    </button>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "rgba(0,15,30,0.7)",
    border: "1px solid rgba(0,200,220,0.18)",
    color: "rgba(200,240,255,0.9)",
    outline: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    width: "100%",
    ...extra,
  };
}

// ─── JSON Formatter ───────────────────────────────────────────────────────────

function JsonFormatter() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState(`{"name":"ZhuuVIP","version":1,"ocean":true}`);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const format = () => {
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutput(formatted);
      const size = new Blob([formatted]).size;
      setStatus({ ok: true, msg: `Valid JSON · ${size} bytes` });
      trackToolUse?.("json");
    } catch (e: unknown) {
      setOutput("");
      setStatus({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  const minify = () => {
    try {
      const parsed = JSON.parse(input);
      const mini = JSON.stringify(parsed);
      setOutput(mini);
      const size = new Blob([mini]).size;
      setStatus({ ok: true, msg: `Minified · ${size} bytes` });
      trackToolUse?.("json");
    } catch (e: unknown) {
      setOutput("");
      setStatus({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  const validate = () => {
    try {
      JSON.parse(input);
      setStatus({ ok: true, msg: "✓ Valid JSON!" });
      trackToolUse?.("json");
    } catch (e: unknown) {
      setStatus({ ok: false, msg: `✗ ${(e as Error).message}` });
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={5}
        placeholder='{"key": "value"}'
        style={inputStyle({ resize: "vertical" })}
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={format} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff", cursor: "pointer" }}>Format</button>
        <button onClick={minify} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "rgba(0,200,220,0.08)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(0,200,220,0.7)", cursor: "pointer" }}>Minify</button>
        <button onClick={validate} className="px-4 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "rgba(0,200,220,0.08)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(0,200,220,0.7)", cursor: "pointer" }}>Validate</button>
        {output && <div className="ml-auto"><CopyBtn text={output} /></div>}
      </div>
      {status && (
        <div className="px-4 py-2 rounded-lg text-xs font-medium" style={{ background: status.ok ? "rgba(0,200,100,0.1)" : "rgba(255,80,80,0.1)", border: `1px solid ${status.ok ? "rgba(0,200,100,0.3)" : "rgba(255,80,80,0.3)"}`, color: status.ok ? "#4ade80" : "#f87171" }}>
          {status.msg}
        </div>
      )}
      {output && (
        <textarea
          readOnly
          value={output}
          rows={7}
          style={inputStyle({ resize: "vertical", color: "#7dd3fc", background: "rgba(0,10,25,0.8)" })}
        />
      )}
    </div>
  );
}

// ─── Color Converter ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function ColorConverter() {
  const trackToolUse = useToolUsage();
  const [hex, setHex] = useState("#00d4ff");
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;

  return (
    <div className="space-y-5">
      <div className="flex gap-4 items-start">
        <div style={{
          width: 100, height: 100, borderRadius: 16, flexShrink: 0,
          background: rgb ? `rgb(${rgb.r},${rgb.g},${rgb.b})` : "#333",
          border: "2px solid rgba(0,200,220,0.2)",
          boxShadow: rgb ? `0 0 30px rgba(${rgb.r},${rgb.g},${rgb.b},0.4)` : "none",
          transition: "all 0.3s ease",
        }} />
        <div className="flex-1 space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "rgba(0,200,220,0.6)" }}>HEX</label>
            <div className="flex gap-2">
              <input type="color" value={hex} onChange={e => setHex(e.target.value)} style={{ width: 40, height: 36, padding: 2, border: "1px solid rgba(0,200,220,0.3)", borderRadius: 8, background: "rgba(0,15,30,0.7)", cursor: "pointer" }} />
              <input value={hex} onChange={e => setHex(e.target.value)} maxLength={7} style={{ ...inputStyle({ flex: 1 }), padding: "8px 12px" }} />
              <CopyBtn text={hex} />
            </div>
          </div>
        </div>
      </div>
      {rgb && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.12)" }}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold" style={{ color: "rgba(0,200,220,0.7)" }}>RGB</span>
              <CopyBtn text={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} />
            </div>
            <div className="space-y-2">
              {[["R", rgb.r, "#ff6b8a"], ["G", rgb.g, "#4ade80"], ["B", rgb.b, "#60a5fa"]].map(([label, val, color]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-4" style={{ color: color as string }}>{label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ width: `${((val as number) / 255) * 100}%`, height: "100%", background: color as string, borderRadius: "999px" }} />
                  </div>
                  <span className="text-xs font-mono w-8 text-right" style={{ color: "rgba(200,240,255,0.7)" }}>{val as number}</span>
                </div>
              ))}
            </div>
          </div>
          {hsl && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.12)" }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold" style={{ color: "rgba(0,200,220,0.7)" }}>HSL</span>
                <CopyBtn text={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
              </div>
              <div className="space-y-2">
                {[["H", hsl.h, 360, "°", "#c084fc"], ["S", hsl.s, 100, "%", "#f9a8d4"], ["L", hsl.l, 100, "%", "#fde68a"]].map(([label, val, max, unit, color]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-4" style={{ color: color as string }}>{label}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ width: `${((val as number) / (max as number)) * 100}%`, height: "100%", background: color as string, borderRadius: "999px" }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right" style={{ color: "rgba(200,240,255,0.7)" }}>{val}{unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="p-4 rounded-xl space-y-2" style={{ background: "rgba(0,15,30,0.5)", border: "1px solid rgba(0,200,220,0.08)" }}>
        <p className="text-xs font-medium mb-2" style={{ color: "rgba(0,200,220,0.5)" }}>Try these palettes</p>
        <div className="flex flex-wrap gap-2">
          {["#00d4ff","#9b59b6","#ff6b6b","#4ade80","#f59e0b","#3b82f6","#ec4899","#ffffff"].map(c => (
            <button key={c} onClick={() => setHex(c)} title={c}
              style={{ width: 28, height: 28, borderRadius: 6, background: c, border: hex === c ? "2px solid white" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Text Utilities ───────────────────────────────────────────────────────────

function TextUtils() {
  const trackToolUse = useToolUsage();
  const [text, setText] = useState("The quick brown fox jumps over the lazy ocean wave.");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const charNoSpace = text.replace(/\s/g, "").length;
  const lineCount = text.split("\n").length;
  const sentenceCount = (text.match(/[.!?]+/g) || []).length;
  const readingTime = Math.ceil(wordCount / 200);

  const transforms: { label: string; fn: () => string }[] = [
    { label: "UPPERCASE", fn: () => text.toUpperCase() },
    { label: "lowercase", fn: () => text.toLowerCase() },
    { label: "Title Case", fn: () => text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) },
    { label: "camelCase", fn: () => text.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_: string, c: string) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase()) },
    { label: "snake_case", fn: () => text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") },
    { label: "kebab-case", fn: () => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") },
    { label: "Reverse", fn: () => text.split("").reverse().join("") },
    { label: "Remove extra spaces", fn: () => text.replace(/\s+/g, " ").trim() },
  ];

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Type or paste your text here..."
        style={inputStyle({ resize: "vertical" })}
      />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          ["Words", wordCount], ["Chars", charCount], ["No spaces", charNoSpace],
          ["Lines", lineCount], ["Sentences", sentenceCount], [`${readingTime} min read`, ""],
        ].map(([label, val]) => (
          <div key={label as string} className="p-3 rounded-xl text-center" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.1)" }}>
            <div className="text-lg font-bold" style={{ color: "#00e5ff" }}>{val !== "" ? val : ""}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(0,200,220,0.5)" }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {transforms.map(({ label, fn }) => (
          <button key={label} onClick={() => {
            setText(fn());
            trackToolUse?.("text");
          }} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            style={{ background: "rgba(0,200,220,0.08)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(0,200,220,0.8)" }}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <CopyBtn text={text} />
      </div>
    </div>
  );
}

// ─── URL Tools ────────────────────────────────────────────────────────────────

function UrlTools() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("https://zhuuvip.com/ai?query=hello world&tab=chat");
  const [output, setOutput] = useState("");
  const [parsed, setParsed] = useState<Record<string, string> | null>(null);

  const encode = () => { setOutput(encodeURIComponent(input)); setParsed(null); trackToolUse?.("url"); };
  const decode = () => { try { setOutput(decodeURIComponent(input)); setParsed(null); trackToolUse?.("url"); } catch { setOutput("Invalid encoded URL"); } };
  const parseUrl = () => {
    try {
      const u = new URL(input.startsWith("http") ? input : "https://" + input);
      const params: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      setParsed({
        Protocol: u.protocol.replace(":", ""),
        Host: u.hostname,
        Port: u.port || "(default)",
        Path: u.pathname,
        "Query Params": Object.keys(params).length > 0 ? JSON.stringify(params) : "(none)",
        Hash: u.hash || "(none)",
      });
      setOutput("");
      trackToolUse?.("url");
    } catch {
      setOutput("Could not parse URL");
      setParsed(null);
    }
  };

  return (
    <div className="space-y-4">
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} placeholder="https://example.com/path?param=value" style={inputStyle({ resize: "vertical" })} />
      <div className="flex flex-wrap gap-2">
        <button onClick={encode} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Encode</button>
        <button onClick={decode} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.08)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(0,200,220,0.7)" }}>Decode</button>
        <button onClick={parseUrl} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.08)", border: "1px solid rgba(0,200,220,0.2)", color: "rgba(0,200,220,0.7)" }}>Parse URL</button>
        {output && <div className="ml-auto"><CopyBtn text={output} /></div>}
      </div>
      {output && <textarea readOnly value={output} rows={3} style={inputStyle({ color: "#7dd3fc", background: "rgba(0,10,25,0.8)", resize: "vertical" })} />}
      {parsed && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,200,220,0.15)" }}>
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(0,200,220,0.08)", background: "rgba(0,15,30,0.5)" }}>
              <span className="text-xs font-semibold w-28 shrink-0" style={{ color: "rgba(0,200,220,0.6)" }}>{k}</span>
              <span className="text-xs font-mono break-all" style={{ color: "#7dd3fc" }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

function Base64Tool() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("Hello, ZhuuVIP! 🌊");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [error, setError] = useState("");

  const run = (m = mode) => {
    setError("");
    try {
      if (m === "encode") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
      trackToolUse?.("base64");
    } catch {
      setError("Invalid Base64 input for decoding");
      setOutput("");
    }
  };

  const toggle = () => {
    const next = mode === "encode" ? "decode" : "encode";
    setMode(next);
    if (output) { setInput(output); setOutput(""); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        {(["encode", "decode"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize cursor-pointer"
            style={{ background: mode === m ? "rgba(0,200,220,0.2)" : "rgba(0,200,220,0.06)", border: mode === m ? "1px solid rgba(0,200,220,0.5)" : "1px solid rgba(0,200,220,0.15)", color: mode === m ? "#00e5ff" : "rgba(0,200,220,0.5)" }}>
            {m}
          </button>
        ))}
        <button onClick={toggle} title="Swap input/output" className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: "rgba(0,200,220,0.06)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(0,200,220,0.6)" }}>
          <RefreshCw size={11} /> Swap
        </button>
      </div>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} placeholder={mode === "encode" ? "Text to encode..." : "Base64 to decode..."} style={inputStyle({ resize: "vertical" })} />
      <button onClick={() => run()} className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        {mode === "encode" ? "Encode to Base64" : "Decode from Base64"}
      </button>
      {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#f87171" }}>{error}</div>}
      {output && (
        <div className="space-y-2">
          <div className="flex justify-end"><CopyBtn text={output} /></div>
          <textarea readOnly value={output} rows={4} style={inputStyle({ color: "#7dd3fc", background: "rgba(0,10,25,0.8)", resize: "vertical" })} />
        </div>
      )}
    </div>
  );
}

// ─── Password Generator ───────────────────────────────────────────────────────

const CHARS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

function PasswordGenerator() {
  const trackToolUse = useToolUsage();
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, numbers: true, symbols: true });
  const [password, setPassword] = useState("");
  const [strength, setStrength] = useState(0);
  const { copied, copy } = useCopy();

  const generate = useCallback(() => {
    let pool = CHARS.lower;
    if (opts.upper) pool += CHARS.upper;
    if (opts.numbers) pool += CHARS.numbers;
    if (opts.symbols) pool += CHARS.symbols;
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    const pwd = Array.from(arr, n => pool[n % pool.length]).join("");
    setPassword(pwd);
    const s = [length > 8, length > 14, opts.upper, opts.numbers, opts.symbols].filter(Boolean).length;
    setStrength(s);
  }, [length, opts, trackToolUse]);

  useEffect(() => { generate(); }, [generate]);

  const strengthInfo = [
    { label: "Very Weak", color: "#ef4444" },
    { label: "Weak", color: "#f97316" },
    { label: "Fair", color: "#eab308" },
    { label: "Strong", color: "#22c55e" },
    { label: "Very Strong", color: "#00e5ff" },
  ][Math.min(strength - 1, 4)] ?? { label: "Weak", color: "#ef4444" };

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "rgba(0,10,25,0.8)", border: "1px solid rgba(0,200,220,0.2)" }}>
        <code className="flex-1 text-sm font-mono break-all" style={{ color: "#e0f2fe", letterSpacing: "0.03em" }}>{password || "Click Generate"}</code>
        <button onClick={() => password && copy(password)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all"
          style={{ background: copied ? "rgba(0,220,100,0.15)" : "rgba(0,200,220,0.1)", border: `1px solid ${copied ? "rgba(0,220,100,0.4)" : "rgba(0,200,220,0.25)"}`, color: copied ? "#4ade80" : "rgba(0,200,220,0.9)" }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {password && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1 flex-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full transition-all" style={{ background: i < strength ? strengthInfo.color : "rgba(255,255,255,0.08)" }} />
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ color: strengthInfo.color }}>{strengthInfo.label}</span>
        </div>
      )}
      <div>
        <div className="flex justify-between text-xs mb-2" style={{ color: "rgba(0,200,220,0.6)" }}>
          <span>Length</span><span className="font-bold" style={{ color: "#00e5ff" }}>{length} characters</span>
        </div>
        <input type="range" min={6} max={64} value={length} onChange={e => setLength(+e.target.value)}
          className="w-full accent-cyan-400" style={{ accentColor: "#00d4ff" }} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(opts) as (keyof typeof opts)[]).map(k => (
          <button key={k} onClick={() => setOpts(o => ({ ...o, [k]: !o[k] }))} className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium capitalize cursor-pointer transition-all"
            style={{ background: opts[k] ? "rgba(0,200,220,0.1)" : "rgba(0,15,30,0.5)", border: opts[k] ? "1px solid rgba(0,200,220,0.35)" : "1px solid rgba(0,200,220,0.1)", color: opts[k] ? "#00e5ff" : "rgba(0,200,220,0.45)" }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: opts[k] ? "#00d4ff" : "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.3)" }} />
            {k}
          </button>
        ))}
      </div>
      <button onClick={() => {
          generate();
          trackToolUse?.("password");
        }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all"
        style={{ background: "linear-gradient(135deg, rgba(0,200,220,0.2), rgba(155,89,182,0.2))", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        <Shuffle size={15} /> Generate New Password
      </button>
    </div>
  );
}

// ─── QR Code ──────────────────────────────────────────────────────────────────

function QrCodeTool() {
  const trackToolUse = useToolUsage();
  const [url, setUrl] = useState("https://zhuuvip.com");
  const [size, setSize] = useState(200);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [qrSrc, setQrSrc] = useState("");
  const [loading, setLoading] = useState(false);

  const buildQrUrl = useCallback((u: string, s: number, fg: string, bg: string) => {
    const f = fg.replace("#", "");
    const b = bg.replace("#", "");
    return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(u)}&color=${f}&bgcolor=${b}&format=png&qzone=1`;
  }, []);

  const generate = useCallback(() => {
    if (!url.trim()) return;
    setLoading(true);
    const src = buildQrUrl(url, size, fgColor, bgColor);
    setQrSrc(src);
  }, [url, size, fgColor, bgColor, buildQrUrl, trackToolUse]);

  useEffect(() => { generate(); }, []);

  const download = async () => {
    const src = buildQrUrl(url, size, fgColor, bgColor);
    const res = await fetch(src);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qrcode.png";
    a.click();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: "rgba(0,200,220,0.6)" }}>URL or Text</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://zhuuvip.com" style={inputStyle()} />
      </div>
      <div>
        <div className="flex justify-between text-xs mb-2" style={{ color: "rgba(0,200,220,0.6)" }}>
          <span>Size</span><span style={{ color: "#00e5ff", fontWeight: 700 }}>{size}px</span>
        </div>
        <input type="range" min={100} max={400} step={10} value={size} onChange={e => setSize(+e.target.value)} className="w-full" style={{ accentColor: "#00d4ff" }} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {([["QR Color", fgColor, setFgColor], ["Background", bgColor, setBgColor]] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, set]) => (
          <div key={label}>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "rgba(0,200,220,0.6)" }}>{label}</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={val} onChange={e => set(e.target.value)}
                style={{ width: 36, height: 36, padding: 2, border: "1px solid rgba(0,200,220,0.3)", borderRadius: 8, background: "rgba(0,15,30,0.7)", cursor: "pointer" }} />
              <input value={val} onChange={e => set(e.target.value)} maxLength={7}
                style={{ ...inputStyle({ flex: 1 }), padding: "8px 10px" }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => {
          generate();
          trackToolUse?.("qr");
        }} className="w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        Generate QR Code
      </button>
      {qrSrc && (
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-2xl" style={{ background: bgColor, border: "1px solid rgba(0,200,220,0.2)" }}>
            <img
              src={qrSrc}
              alt="QR Code"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              style={{ width: Math.min(size, 280), height: Math.min(size, 280), display: "block", imageRendering: "pixelated" }}
            />
          </div>
          {loading && <p className="text-xs" style={{ color: "rgba(0,200,220,0.5)" }}>Generating…</p>}
          <button onClick={download} className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all w-full justify-center"
            style={{ background: "linear-gradient(135deg, rgba(0,200,220,0.25), rgba(0,100,255,0.2))", border: "1px solid rgba(0,200,220,0.4)", color: "#00e5ff" }}>
            <Download size={14} /> Download PNG
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Markdown Preview ─────────────────────────────────────────────────────────

function parseMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^#{6}\s(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#{5}\s(.+)$/gm, "<h5>$1</h5>")
    .replace(/^#{4}\s(.+)$/gm, "<h4>$1</h4>")
    .replace(/^#{3}\s(.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{2}\s(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{1}\s(.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^>\s(.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    .replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>")
    .replace(/^[-*]\s(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n(?![<])/g, "<br>");
  return html;
}

const SAMPLE_MD = `# Hello ZhuuVIP 🌊

**Bold text**, *italic*, and ~~strikethrough~~.

## Features

- JSON Formatter
- Color Converter
- QR Code Generator

## Code Example

\`\`\`
const greet = () => "Hello, ocean!";
\`\`\`

> The deep sea holds infinite wisdom.

[Visit ZhuuVIP](https://zhuuvip.com)
`;

function MarkdownPreview() {
  const trackToolUse = useToolUsage();
  const [md, setMd] = useState(SAMPLE_MD);
  const html = parseMarkdown(md);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: 320 }}>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(0,200,220,0.5)" }}>MARKDOWN INPUT</p>
          <textarea
            value={md}
            onChange={e => setMd(e.target.value)}
            style={{ ...inputStyle({ resize: "none", height: 300 }) }}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-semibold" style={{ color: "rgba(0,200,220,0.5)" }}>HTML PREVIEW</p>
            <CopyBtn text={html} />
          </div>
          <div
            className="p-4 rounded-xl overflow-auto"
            style={{ background: "rgba(0,15,30,0.7)", border: "1px solid rgba(0,200,220,0.18)", height: 300, color: "rgba(200,240,255,0.85)", fontSize: 13, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Hash Generator (SHA-256/384/512, Web Crypto API) ──────────────────────────

function HashGenerator() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("ZhuuVIP");
  const [algo, setAlgo] = useState<"SHA-256" | "SHA-384" | "SHA-512">("SHA-256");
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(input));
    setHash(Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(""));
    trackToolUse?.("hash");
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Text to hash..." style={inputStyle({ resize: "vertical" })} />
      <div className="flex gap-2">
        {(["SHA-256", "SHA-384", "SHA-512"] as const).map((a) => (
          <button key={a} onClick={() => setAlgo(a)} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            style={{ background: algo === a ? "rgba(0,200,220,0.15)" : "rgba(0,200,220,0.06)", border: `1px solid rgba(0,200,220,${algo === a ? 0.4 : 0.15})`, color: algo === a ? "#00e5ff" : "rgba(0,200,220,0.6)" }}>
            {a}
          </button>
        ))}
      </div>
      <button onClick={generate} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        {loading ? "Hashing…" : "Generate Hash"}
      </button>
      {hash && (
        <div className="flex items-center gap-2">
          <div className="flex-1 p-3 rounded-xl text-xs font-mono break-all" style={{ background: "rgba(0,10,25,0.8)", border: "1px solid rgba(0,200,220,0.18)", color: "#7dd3fc" }}>{hash}</div>
          <CopyBtn text={hash} />
        </div>
      )}
    </div>
  );
}

// ─── UUID Generator ─────────────────────────────────────────────────────────────

function UuidGenerator() {
  const trackToolUse = useToolUsage();
  const [uuids, setUuids] = useState<string[]>([crypto.randomUUID()]);
  const [count, setCount] = useState(5);

  const generate = () => {
    setUuids(Array.from({ length: count }, () => crypto.randomUUID()));
    trackToolUse?.("uuid");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold" style={{ color: "rgba(0,200,220,0.5)" }}>Jumlah:</label>
        <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} style={inputStyle({ width: 80 })} />
        <button onClick={generate} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Generate</button>
        <div className="ml-auto"><CopyBtn text={uuids.join("\n")} /></div>
      </div>
      <div className="space-y-1.5">
        {uuids.map((u, i) => (
          <div key={i} className="px-3 py-2 rounded-lg text-xs font-mono" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.1)", color: "#7dd3fc" }}>{u}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Timestamp Converter ────────────────────────────────────────────────────────

function TimestampConverter() {
  const trackToolUse = useToolUsage();
  const [unix, setUnix] = useState(String(Math.floor(Date.now() / 1000)));
  const [iso, setIso] = useState(new Date().toISOString());

  const fromUnix = (v: string) => {
    setUnix(v);
    const n = Number(v);
    if (!isNaN(n)) {
      setIso(new Date(n * (v.length > 10 ? 1 : 1000)).toISOString());
      trackToolUse?.("timestamp");
    }
  };
  const fromIso = (v: string) => {
    setIso(v);
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      setUnix(String(Math.floor(d.getTime() / 1000)));
      trackToolUse?.("timestamp");
    }
  };
  const now = () => {
    const n = Date.now();
    setUnix(String(Math.floor(n / 1000)));
    setIso(new Date(n).toISOString());
    trackToolUse?.("timestamp");
  };

  return (
    <div className="space-y-4">
      <button onClick={now} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Use Now</button>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>UNIX TIMESTAMP</label>
        <input value={unix} onChange={(e) => fromUnix(e.target.value)} style={inputStyle()} />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>ISO 8601 / LOCAL DATE STRING</label>
        <input value={iso} onChange={(e) => fromIso(e.target.value)} style={inputStyle()} />
      </div>
      <div className="p-3 rounded-xl text-xs" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.1)", color: "rgba(200,240,255,0.75)" }}>
        Local: {isNaN(new Date(iso).getTime()) ? "—" : new Date(iso).toLocaleString("id-ID")}
      </div>
    </div>
  );
}

// ─── Lorem Ipsum Generator ───────────────────────────────────────────────────────

const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ocean deep sea wave current tide reef".split(" ");

function LoremGenerator() {
  const trackToolUse = useToolUsage();
  const [paragraphs, setParagraphs] = useState(3);
  const [text, setText] = useState("");

  const generate = () => {
    const out = Array.from({ length: paragraphs }, () => {
      const len = 30 + Math.floor(Math.random() * 30);
      const words = Array.from({ length: len }, () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
      words[0] = words[0][0].toUpperCase() + words[0].slice(1);
      return words.join(" ") + ".";
    }).join("\n\n");
    setText(out);
    trackToolUse?.("lorem");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold" style={{ color: "rgba(0,200,220,0.5)" }}>Paragraf:</label>
        <input type="number" min={1} max={20} value={paragraphs} onChange={(e) => setParagraphs(Number(e.target.value))} style={inputStyle({ width: 80 })} />
        <button onClick={generate} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Generate</button>
        {text && <div className="ml-auto"><CopyBtn text={text} /></div>}
      </div>
      {text && <textarea readOnly value={text} rows={10} style={inputStyle({ resize: "vertical" })} />}
    </div>
  );
}

// ─── Regex Tester ────────────────────────────────────────────────────────────────

function RegexTester() {
  const trackToolUse = useToolUsage();
  const [pattern, setPattern] = useState("[A-Z][a-z]+");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("Zhuu VIP Deep Ocean Tools");
  let matches: string[] = [];
  let error = "";
  try {
    matches = [...text.matchAll(new RegExp(pattern, flags.includes("g") ? flags : flags + "g"))].map((m) => m[0]);
  } catch (e) { error = (e as Error).message; }

  const testRegex = () => {
    if (!error) {
      trackToolUse?.("regex");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="pattern" style={inputStyle({ flex: 1 })} />
        <input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="flags" style={inputStyle({ width: 70 })} />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={inputStyle({ resize: "vertical" })} />
      <button
        onClick={testRegex}
        className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}
      >
        Test Regex
      </button>
      {error ? (
        <div className="text-xs" style={{ color: "#f87171" }}>{error}</div>
      ) : (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "rgba(0,200,220,0.5)" }}>{matches.length} MATCH{matches.length !== 1 ? "ES" : ""}</p>
          <div className="flex flex-wrap gap-1.5">
            {matches.map((m, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-xs font-mono" style={{ background: "rgba(0,220,100,0.12)", border: "1px solid rgba(0,220,100,0.3)", color: "#4ade80" }}>{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── IQC Chat Maker (WhatsApp/iMessage-style chat bubble via Lanz API) ──────
// Diteruskan lewat backend proxy sendiri (/api/tools/lanz/iqc) — lihat
// artifacts/api-server/src/routes/tools.ts. Publik, tidak perlu login.
// Menggantikan tool "IQC Generator" (canvas certificate) yang lama.

const IQC_BUBBLE_COLORS = ["Grey", "Blue", "Green"];
const IQC_MENU_COLORS = ["Grey", "Black", "Blue", "Purple"];
const IQC_TEXT_COLORS = ["White", "Black"];
const IQC_FONTS = ["Bold", "Regular", "Italic"];

function IqcChatMaker() {
  const trackToolUse = useToolUsage();
  const [text, setText] = useState("Halo!");
  const [chatTime, setChatTime] = useState("17.32");
  const [statusBarTime, setStatusBarTime] = useState("Online");
  const [signalName, setSignalName] = useState("5G");
  const [bubbleColor, setBubbleColor] = useState("#808080");
  const [menuColor, setMenuColor] = useState("#808080");
  const [textColor, setTextColor] = useState("White");
  const [fontName, setFontName] = useState("Bold");
  const [imgUrl, setImgUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buildParams = () =>
    new URLSearchParams({
      text: text.trim() || "Halo!",
      chatTime,
      statusBarTime,
      bubbleColor,
      menuColor,
      textColor,
      fontName,
      signalName,
    });

  const apiUrl = `${API_BASE}/api/tools/lanz/iqc?${buildParams().toString()}`;

  const generate = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setImgUrl("");
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal generate gambar");
      }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
      trackToolUse?.("iqc");
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = "iqc-chat-maker.png";
    a.click();
  };

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Tulis pesan chat-nya..."
        style={inputStyle({ resize: "vertical" })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>Jam chat</label>
          <input value={chatTime} onChange={(e) => setChatTime(e.target.value)} placeholder="17.32" style={inputStyle()} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>Jam status bar</label>
          <input value={statusBarTime} onChange={(e) => setStatusBarTime(e.target.value)} placeholder="Online" style={inputStyle()} />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>Nama sinyal / operator</label>
        <input value={signalName} onChange={(e) => setSignalName(e.target.value)} placeholder="5G" style={inputStyle()} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="text-xs font-semibold block mb-1.5"
            style={{ color: "rgba(0,200,220,0.5)" }}
          >
            Warna bubble
          </label>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bubbleColor}
              onChange={(e) => setBubbleColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer"
              style={{
                background: "transparent",
                border: "1px solid rgba(0,200,220,0.35)",
              }}
            />

            <input
              type="text"
              value={bubbleColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  setBubbleColor(value);
                }
              }}
              placeholder="#808080"
              maxLength={7}
              className="flex-1 min-w-0"
              style={inputStyle()}
            />
          </div>
        </div>

        <div>
          <label
            className="text-xs font-semibold block mb-1.5"
            style={{ color: "rgba(0,200,220,0.5)" }}
          >
            Warna menu
          </label>

          <div className="flex items-center gap-2">
            <input
              type="color"
              value={menuColor}
              onChange={(e) => setMenuColor(e.target.value)}
              className="w-12 h-10 rounded-lg cursor-pointer"
              style={{
                background: "transparent",
                border: "1px solid rgba(0,200,220,0.35)",
              }}
            />

            <input
              type="text"
              value={menuColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                  setMenuColor(value);
                }
              }}
              placeholder="#808080"
              maxLength={7}
              className="flex-1 min-w-0"
              style={inputStyle()}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>Warna teks</label>
          <select value={textColor} onChange={(e) => setTextColor(e.target.value)} style={inputStyle()}>
            {IQC_TEXT_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1.5" style={{ color: "rgba(0,200,220,0.5)" }}>Font</label>
          <select value={fontName} onChange={(e) => setFontName(e.target.value)} style={inputStyle()}>
            {IQC_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={generate} disabled={loading || !text.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
          style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
          {loading ? "Membuat…" : "Generate"}
        </button>
        <CopyBtn text={apiUrl} />
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {imgUrl && (
        <div className="flex flex-col items-center gap-4">
          <div className="p-2 rounded-2xl" style={{ background: "#000", border: "1px solid rgba(0,200,220,0.2)" }}>
            <img src={imgUrl} alt="IQC chat" style={{ maxWidth: "100%", display: "block", borderRadius: 8 }} />
          </div>
          <button onClick={download} className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all w-full justify-center"
            style={{ background: "linear-gradient(135deg, rgba(0,200,220,0.25), rgba(0,100,255,0.2))", border: "1px solid rgba(0,200,220,0.4)", color: "#00e5ff" }}>
            <Download size={14} /> Download PNG
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Windows Quotes (fake Windows error dialog image) ───────────────────────────

function WindowsQuotes() {
  const trackToolUse = useToolUsage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quote, setQuote] = useState("Hidup itu kayak Windows Update,\nkadang kamu cuma bisa nunggu.");
  const [author, setAuthor] = useState("Bill Gates (mungkin)");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 820; canvas.height = 260;

    // Window frame
    ctx.fillStyle = "#c0c0c0"; ctx.fillRect(0, 0, 820, 260);
    ctx.fillStyle = "#000080"; ctx.fillRect(0, 0, 820, 34);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px 'Segoe UI', sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Windows Quotes", 12, 23);
    // fake buttons
    ["#c0c0c0", "#c0c0c0", "#c0c0c0"].forEach((c, i) => {
      ctx.fillStyle = c; ctx.fillRect(820 - 30 * (3 - i) - 6, 6, 24, 22);
      ctx.strokeStyle = "#808080"; ctx.strokeRect(820 - 30 * (3 - i) - 6, 6, 24, 22);
    });

    // icon (info bubble)
    ctx.fillStyle = "#0057d8";
    ctx.beginPath(); ctx.arc(90, 130, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 40px Georgia"; ctx.textAlign = "center";
    ctx.fillText("i", 90, 145);

    // quote text
    ctx.fillStyle = "#000"; ctx.textAlign = "left"; ctx.font = "20px 'Segoe UI', sans-serif";
    const lines = quote.split("\n");
    lines.forEach((line, i) => ctx.fillText(line, 150, 90 + i * 28));

    ctx.font = "italic 16px 'Segoe UI', sans-serif"; ctx.fillStyle = "#333";
    ctx.fillText(`— ${author}`, 150, 90 + lines.length * 28 + 20);

    // OK button
    ctx.fillStyle = "#c0c0c0"; ctx.strokeStyle = "#808080";
    ctx.fillRect(700, 210, 90, 32); ctx.strokeRect(700, 210, 90, 32);
    ctx.fillStyle = "#000"; ctx.font = "14px 'Segoe UI', sans-serif"; ctx.textAlign = "center";
    ctx.fillText("OK", 745, 231);
  }, [quote, author]);

  useEffect(() => { draw(); }, [draw]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "windows-quote.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
    trackToolUse?.("windows");
  };

  return (
    <div className="space-y-4">
      <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={3} placeholder="Quote-nya..." style={inputStyle({ resize: "vertical" })} />
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Nama tokoh" style={inputStyle()} />
      <canvas ref={canvasRef} className="w-full rounded-xl" style={{ border: "1px solid rgba(0,200,220,0.18)" }} />
      <button onClick={download} className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        <Download size={14} /> Download PNG
      </button>
    </div>
  );
}

// ─── API base for our own backend (Express server) ─────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL).replace(/\/$/, "");

// ─── Lanz Maker Tools (BRAT image generator via lanzapi.my.id) ─────────────
// Proxied through our own backend (/api/tools/lanz/:tool) — see
// artifacts/api-server/src/routes/tools.ts. Public, no login required.

function LanzMakerTool({ endpoint, filename }: { endpoint: "iqc" | "brat"; filename: string }) {
  const trackToolUse = useToolUsage();
  const [text, setText] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setImgUrl("");
    try {
      const res = await fetch(`${API_BASE}/api/tools/lanz/${endpoint}?text=${encodeURIComponent(text.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal generate gambar");
      }
      const blob = await res.blob();
      setImgUrl(URL.createObjectURL(blob));
      trackToolUse?.(endpoint);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Tulis teks di sini..."
        style={inputStyle({ resize: "vertical" })}
      />
      <button onClick={generate} disabled={loading || !text.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        {loading ? "Membuat…" : "Generate"}
      </button>
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.25)", color: "#f87171" }}>
          {error}
        </div>
      )}
      {imgUrl && (
        <div className="flex flex-col items-center gap-4">
          <div className="p-2 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(0,200,220,0.2)" }}>
            <img src={imgUrl} alt={filename} style={{ maxWidth: "100%", display: "block", borderRadius: 8 }} />
          </div>
          <button onClick={download} className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all w-full justify-center"
            style={{ background: "linear-gradient(135deg, rgba(0,200,220,0.25), rgba(0,100,255,0.2))", border: "1px solid rgba(0,200,220,0.4)", color: "#00e5ff" }}>
            <Download size={14} /> Download PNG
          </button>
        </div>
      )}
    </div>
  );
}

function BratGenerator() {
  return <LanzMakerTool endpoint="brat" filename="brat.png" />;
}

// ─── Tanya Ustad (one-shot AI Q&A, requires sign-in) ────────────────────────────

function TanyaUstad() {
  const trackToolUse = useToolUsage();
  const { isSignedIn, getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true); setError(""); setAnswer("");
    try {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/api/tools/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tool: "ustad", message: question.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Gagal mendapat jawaban");
      setAnswer(data.reply);
      trackToolUse?.("ustad");
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan, coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="text-center py-10">
        <p className="text-sm" style={{ color: "rgba(0,200,220,0.55)" }}>Login dulu buat pakai Tanya Ustad ya.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
        placeholder="Contoh: hukum sholat jamak itu gimana?" style={inputStyle({ resize: "vertical" })} />
      <button onClick={ask} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
        style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
        {loading ? "Menjawab…" : "🕌 Tanya"}
      </button>
      {error && <div className="text-xs" style={{ color: "#f87171" }}>{error}</div>}
      {answer && (
        <div className="p-4 rounded-xl text-sm whitespace-pre-line leading-relaxed" style={{ background: "rgba(0,15,30,0.6)", border: "1px solid rgba(0,200,220,0.15)", color: "rgba(200,240,255,0.85)" }}>
          {answer}
        </div>
      )}
      <p className="text-[10px]" style={{ color: "rgba(0,200,220,0.35)" }}>Jawaban AI bersifat edukatif — untuk keputusan fiqih penting, konfirmasikan ke ustad/ulama setempat.</p>
    </div>
  );
}

// ─── Tool Rating & Reviews (public, per-tool) ───────────────────────────────

interface ToolStat { toolId: string; uses: number; avgRating: number | null; ratingCount: number; }
interface ToolReview { rating: number; comment: string | null; createdAt: string; }

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl leading-none cursor-pointer transition-transform hover:scale-110"
          style={{ color: (hover || value) >= n ? "#fbbf24" : "rgba(0,200,220,0.2)" }}
        >★</button>
      ))}
    </div>
  );
}

function ToolRatingBox({ toolId }: { toolId: string }) {
  const { isSignedIn, getToken } = useAuth();
  const [reviews, setReviews] = useState<ToolReview[]>([]);
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setReviews([]); setMyRating(0); setComment(""); setDone(false);
    fetch(`${API_BASE}/api/tools/${toolId}/feedback`)
      .then((r) => r.json()).then((d) => Array.isArray(d) && setReviews(d))
      .catch(() => {});
  }, [toolId]);

  const submit = async () => {
    if (!myRating) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/api/tools/${toolId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ rating: myRating, comment }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Gagal menyimpan rating");
      }

      setDone(true);
      const r = await fetch(`${API_BASE}/api/tools/${toolId}/feedback`);
      setReviews(await r.json());
    } catch {
      // silent — rating is a nice-to-have, don't interrupt the tool experience
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(0,200,220,0.12)" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(0,200,220,0.6)" }}>⭐ Rating & Ulasan</h3>

      {!isSignedIn ? (
        <p className="text-xs mb-5" style={{ color: "rgba(0,200,220,0.4)" }}>Login buat kasih rating tool ini.</p>
      ) : done ? (
        <p className="text-xs mb-5" style={{ color: "#4ade80" }}>✓ Makasih atas rating-nya!</p>
      ) : (
        <div className="mb-5 space-y-3">
          <StarPicker value={myRating} onChange={setMyRating} />
          {myRating > 0 && (
            <>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Komentar (opsional)" style={inputStyle()} />
              <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>
                {submitting ? "Mengirim…" : "Kirim Rating"}
              </button>
            </>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-2">
          {reviews.slice(0, 8).map((r, i) => (
            <div key={i} className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(0,15,30,0.5)", border: "1px solid rgba(0,200,220,0.08)" }}>
              <span style={{ color: "#fbbf24" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              {r.comment && <span className="ml-2" style={{ color: "rgba(200,240,255,0.65)" }}>{r.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  { id: "json",     icon: "{ }",  name: "JSON Formatter",   desc: "Format, validate & minify JSON",   component: <JsonFormatter /> },
  { id: "color",    icon: "🎨",   name: "Color Converter",  desc: "HEX → RGB → HSL conversions",     component: <ColorConverter /> },
  { id: "text",     icon: "Aa",   name: "Text Utilities",   desc: "Word count, case converter & more", component: <TextUtils /> },
  { id: "url",      icon: "🔗",   name: "URL Tools",        desc: "Encode, decode & parse URLs",      component: <UrlTools /> },
  { id: "base64",   icon: "64",   name: "Base64",           desc: "Encode & decode Base64 strings",   component: <Base64Tool /> },
  { id: "password", icon: "🔑",   name: "Password Generator", desc: "Secure, customizable passwords",  component: <PasswordGenerator /> },
  { id: "qr",       icon: "▦",    name: "QR Code",          desc: "Generate QR codes instantly",      component: <QrCodeTool /> },
  { id: "markdown", icon: "Md",   name: "Markdown Preview", desc: "Live Markdown → HTML rendering",   component: <MarkdownPreview /> },
  { id: "hash",     icon: "#",    name: "Hash Generator",   desc: "SHA-256 / 384 / 512 digest",       component: <HashGenerator /> },
  { id: "uuid",     icon: "ID",   name: "UUID Generator",   desc: "Generate v4 UUIDs in bulk",        component: <UuidGenerator /> },
  { id: "timestamp",icon: "⏱",   name: "Timestamp",        desc: "Unix ⇄ ISO date conversion",       component: <TimestampConverter /> },
  { id: "lorem",    icon: "¶",    name: "Lorem Ipsum",      desc: "Placeholder text generator",       component: <LoremGenerator /> },
  { id: "regex",    icon: ".*",   name: "Regex Tester",     desc: "Test patterns against text",       component: <RegexTester />, premium: true },
  { id: "winquote", icon: "🪟",   name: "Windows Quotes",   desc: "Quote ala dialog box Windows",     component: <WindowsQuotes /> },
  { id: "brat",     icon: "🐐",   name: "Brat Generator",   desc: "Gambar teks ala Brat (Lanz API)",  component: <BratGenerator /> },
  { id: "lanziqc",  icon: "💬",   name: "IQC Chat Maker",   desc: "Chat bubble ala WhatsApp/iMessage custom (Lanz API)", component: <IqcChatMaker /> },
  { id: "ustad",    icon: "🕌",   name: "Tanya Ustad",      desc: "Tanya seputar agama (AI)",         component: <TanyaUstad /> },
];

const ToolUsageContext = createContext<((toolId: string) => void) | null>(null);

function useToolUsage() {
  return useContext(ToolUsageContext);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevToolsPage() {
  const [activeId, setActiveId] = useState("qr");
  const activeTool = TOOLS.find(t => t.id === activeId)!;
  const panelRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<Record<string, ToolStat>>({});

  const { getToken, isSignedIn } = useAuth();

  const [usage, setUsage] = useState<DailyUsage>({
    used: 0,
    remaining: 30,
    limit: 30,
  });

  const loadUsage = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(
        `${API_BASE}/api/anthropic/daily-limit`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) return;

      const data = await res.json();

      setUsage({
        used: Number(data.used ?? 0),
        remaining: Number(data.remaining ?? 30),
        limit: Number(data.limit ?? 30),
      });
    } catch {
      // Keep last known usage.
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const trackToolUse = useCallback((toolId: string) => {
    fetch(`${API_BASE}/api/tools/${toolId}/track`, {
      method: "POST",
    }).catch(() => {});

    loadUsage();

    setStats((prev) => {
      const existing = prev[toolId];
      return {
        ...prev,
        [toolId]: {
          toolId,
          avgRating: existing?.avgRating ?? null,
          ratingCount: existing?.ratingCount ?? 0,
          uses: (existing?.uses ?? 0) + 1,
        },
      };
    });
  }, [loadUsage]);

  useEffect(() => {
    fetch(`${API_BASE}/api/tools/stats`)
      .then((r) => r.json())
      .then((rows: ToolStat[]) => {
        if (Array.isArray(rows)) setStats(Object.fromEntries(rows.map((r) => [r.toolId, r])));
      })
      .catch(() => {});
  }, []);

  // TODO: wire this to the real tier/membership system once it exists
  // (e.g. a useUserTier() hook checking premium/vip status via the API).
  const hasPremium = false;
  const isLocked = !!activeTool.premium && !hasPremium;

  const selectTool = (id: string) => {
    setActiveId(id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="ocean-bg min-h-[calc(100dvh-64px)] min-w-0 pt-4 sm:pt-6 pb-28 px-3 sm:px-4 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="text-center sm:text-left min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>
                Developer Tools
              </h1>

              <p className="text-xs sm:text-sm" style={{ color: "rgba(0,200,220,0.5)" }}>
                {TOOLS.length} professional web utilities — no installs, no sign-up
              </p>
            </div>

            {isSignedIn && <DailyLimitBar usage={usage} />}
          </div>
        </div>

        {/* Tool Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          {TOOLS.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              name={tool.name}
              desc={tool.desc}
              active={activeId === tool.id}
              locked={tool.premium}
              uses={stats[tool.id]?.uses}
              avgRating={stats[tool.id]?.avgRating}
              onClick={() => selectTool(tool.id)}
            />
          ))}
        </div>

        {/* Active Tool Panel */}
        <div
          ref={panelRef}
          className="rounded-2xl p-4 sm:p-6 scroll-mt-4"
          style={{
            background: "rgba(0,15,35,0.7)",
            border: "1px solid rgba(0,200,220,0.2)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="text-2xl font-mono font-bold w-12 h-12 flex items-center justify-center rounded-xl"
              style={{ background: "rgba(0,200,220,0.1)", border: "1px solid rgba(0,200,220,0.3)", color: "#00e5ff" }}>
              {activeTool.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#00e5ff", fontFamily: "Poppins, Inter, sans-serif" }}>{activeTool.name}</h2>
              <p className="text-xs" style={{ color: "rgba(0,200,220,0.5)" }}>{activeTool.desc}</p>
            </div>
          </div>
          {isLocked ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-3">🔒</div>
              <p className="mb-1 font-semibold" style={{ color: "#e0f7fa" }}>Tool VIP</p>
              <p className="text-sm" style={{ color: "rgba(0,200,220,0.5)" }}>Fitur ini bakal kebuka begitu sistem membership aktif.</p>
            </div>
          ) : (
            <>
              <ToolUsageContext.Provider value={trackToolUse}>
                {activeTool.component}
              </ToolUsageContext.Provider>
              <ToolRatingBox toolId={activeTool.id} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
