import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import { Copy, Download, RefreshCw, Check, Shuffle } from "lucide-react";
import { useAuth } from "@clerk/react";

const API_BASE = "https://zhuuapi.vercel.app";

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

function ToolCard({
  icon, name, desc, active, onClick,
}: {
  icon: React.ReactNode; name: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative z-50 text-left p-4 rounded-xl transition-all duration-200 cursor-pointer"
      style={{
        background: active ? "rgba(0,200,220,0.1)" : "rgba(0,20,40,0.45)",
        border: active ? "1.5px solid rgba(0,200,220,0.5)" : "1px solid rgba(0,200,220,0.12)",
        boxShadow: active ? "0 0 16px rgba(0,200,220,0.12)" : "none",
      }}
    >
      <div className="text-2xl mb-2 font-mono font-bold" style={{ color: active ? "#00e5ff" : "rgba(0,200,220,0.6)" }}>
        {icon}
      </div>
      <div className="text-sm font-semibold mb-1" style={{ color: active ? "#00e5ff" : "rgba(200,240,255,0.8)" }}>
        {name}
      </div>
      <div className="text-xs" style={{ color: "rgba(0,200,220,0.45)" }}>{desc}</div>
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
  const [input, setInput] = useState(`{"name":"ZhuuVIP","version":1,"ocean":true}`);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const format = async () => {
    const allowed = await useToolUsage()?.("json");

    if (!allowed) return;

    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutput(formatted);
      const size = new Blob([formatted]).size;
      setStatus({ ok: true, msg: `Valid JSON · ${size} bytes` });
    } catch (e: unknown) {
      setOutput("");
      setStatus({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  const minify = async () => {
    const allowed = await useToolUsage()?.("json");

    if (!allowed) return;

    try {
      const parsed = JSON.parse(input);
      const mini = JSON.stringify(parsed);
      setOutput(mini);
      const size = new Blob([mini]).size;
      setStatus({ ok: true, msg: `Minified · ${size} bytes` });
    } catch (e: unknown) {
      setOutput("");
      setStatus({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
  };

  const validate = async () => {
    const allowed = await useToolUsage()?.("json");

    if (!allowed) return;

    try {
      JSON.parse(input);
      setStatus({ ok: true, msg: "✓ Valid JSON!" });
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

  const convert = async () => {
    const allowed = await trackToolUse?.("color");
    if (!allowed) return;
  };

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

      <button
        onClick={convert}
        className="w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        Convert Color
      </button>

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
          <button
  key={label}
  onClick={async () => {
    const allowed = await trackToolUse?.("text");
    if (!allowed) return;
    setText(fn());
  }}
  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
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

  const encode = async () => {
    const allowed = await trackToolUse?.("url");
    if (!allowed) return;

    setOutput(encodeURIComponent(input));
    setParsed(null);
  };
  const decode = async () => {
    const allowed = await trackToolUse?.("url");
    if (!allowed) return;

    try {
      setOutput(decodeURIComponent(input));
      setParsed(null);
    } catch {
      setOutput("Invalid encoded URL");
    }
  };
  const parseUrl = async () => {
    const allowed = await trackToolUse?.("url");
    if (!allowed) return;
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

  const run = async (m = mode) => {
    const allowed = await trackToolUse?.("base64");
    if (!allowed) return;

    setError("");
    try {
      if (m === "encode") {
        setOutput(btoa(unescape(encodeURIComponent(input))));
      } else {
        setOutput(decodeURIComponent(escape(atob(input))));
      }
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
  }, [length, opts]);

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
      <button onClick={async () => {
            const allowed = await trackToolUse?.("password");
            if (!allowed) return;
            generate();
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
  }, [url, size, fgColor, bgColor, buildQrUrl]);

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
      <button onClick={async () => {
          const allowed = await trackToolUse?.("qr");
          if (!allowed) return;
          generate();
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
  const [html, setHtml] = useState(() => parseMarkdown(md));

  const preview = async () => {
    const allowed = await trackToolUse?.("markdown");
    if (!allowed) return;
    setHtml(parseMarkdown(md));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: 320 }}>
        <div>
          <p
            className="text-xs font-semibold mb-2"
            style={{ color: "rgba(0,200,220,0.5)" }}
          >
            MARKDOWN INPUT
          </p>

          <textarea
            value={md}
            onChange={e => setMd(e.target.value)}
            style={{ ...inputStyle({ resize: "none", height: 300 }) }}
          />

          <button
            onClick={preview}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
            style={{
              background: "rgba(0,200,220,0.15)",
              border: "1px solid rgba(0,200,220,0.35)",
              color: "#00e5ff"
            }}
          >
            Preview Markdown
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <p
              className="text-xs font-semibold"
              style={{ color: "rgba(0,200,220,0.5)" }}
            >
              HTML PREVIEW
            </p>
            <CopyBtn text={html} />
          </div>

          <div
            className="p-4 rounded-xl overflow-auto"
            style={{
              background: "rgba(0,15,30,0.7)",
              border: "1px solid rgba(0,200,220,0.18)",
              height: 300,
              color: "rgba(200,240,255,0.85)",
              fontSize: 13,
              lineHeight: 1.7
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

function CalculatorTool() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("12 * (8 + 2)");
  const [result, setResult] = useState("");

  const calculate = async () => {
    const allowed = await trackToolUse?.("calculator");
    if (!allowed) return;
    try {
      if (!/^[0-9+\-*/().%\s]+$/.test(input)) throw new Error("Invalid expression");
      const value = Function(`"use strict"; return (${input})`)();
      if (!Number.isFinite(value)) throw new Error("Invalid result");
      setResult(String(value));
    } catch {
      setResult("Error: expression tidak valid");
    }
  };

  return (
    <div className="space-y-4">
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && calculate()} placeholder="12 * (8 + 2)" style={inputStyle()} />
      <button onClick={calculate} className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Calculate</button>
      {result && <div className="p-4 rounded-xl text-xl font-bold font-mono break-all" style={{ background: "rgba(0,10,25,0.8)", border: "1px solid rgba(0,200,220,0.15)", color: "#7dd3fc" }}>{result}</div>}
    </div>
  );
}

function JwtDecoder() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const decode = async () => {
    const allowed = await trackToolUse?.("jwt");
    if (!allowed) return;
    try {
      const parts = input.trim().split(".");
      if (parts.length !== 3) throw new Error();
      const decodePart = (part: string) => {
        const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
        return JSON.parse(decodeURIComponent(Array.from(atob(padded)).map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")));
      };
      setOutput(JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2));
    } catch {
      setOutput("Invalid JWT");
    }
  };

  return (
    <div className="space-y-4">
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={5} placeholder="Paste JWT token..." style={inputStyle({ resize: "vertical" })} />
      <button onClick={decode} className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer" style={{ background: "rgba(0,200,220,0.15)", border: "1px solid rgba(0,200,220,0.35)", color: "#00e5ff" }}>Decode JWT</button>
      {output && <div className="space-y-2"><div className="flex justify-end"><CopyBtn text={output} /></div><textarea readOnly value={output} rows={12} style={inputStyle({ color: "#7dd3fc", background: "rgba(0,10,25,0.8)", resize: "vertical" })} /></div>}
      <p className="text-[10px]" style={{ color: "rgba(200,240,255,0.4)" }}>JWT hanya di-decode di browser. Tool ini tidak memverifikasi signature.</p>
    </div>
  );
}

const ToolUsageContext = createContext<
  ((toolId: string) => Promise<boolean>) | null
>(null);

function useToolUsage() {
  return useContext(ToolUsageContext);
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
function SlugGenerator() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("Hello ZhuuAI Developer Tools!");
  const [output, setOutput] = useState("");

  const generate = async () => {
    const allowed = await trackToolUse?.("slug");

    if (!allowed) return;

    const slug = input
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    setOutput(slug);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={4}
        placeholder="Masukkan judul..."
        style={inputStyle({ resize: "vertical" })}
      />
      <button
        onClick={generate}
        className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        Generate Slug
      </button>
      {output && (
        <div className="flex gap-2">
          <input readOnly value={output} style={inputStyle()} />
          <CopyBtn text={output} />
        </div>
      )}
    </div>
  );
}

function RandomGenerator() {
  const trackToolUse = useToolUsage();
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [result, setResult] = useState("");

  const generate = async () => {
    const allowed = await trackToolUse?.("random");
    if (!allowed) return;
    const a = Number(min);
    const b = Number(max);

    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) {
      setResult("Range tidak valid");
      return;
    }

    setResult(String(Math.floor(Math.random() * (b - a + 1)) + a));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <input value={min} onChange={e => setMin(e.target.value)} placeholder="Min" style={inputStyle()} />
        <input value={max} onChange={e => setMax(e.target.value)} placeholder="Max" style={inputStyle()} />
      </div>
      <button
        onClick={generate}
        className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        🎲 Generate Random Number
      </button>
      {result && (
        <div className="text-center text-4xl font-black font-mono py-6" style={{ color: "#00e5ff" }}>
          {result}
        </div>
      )}
    </div>
  );
}

function WhitespaceCleaner() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const clean = async () => {
    const allowed = await trackToolUse?.("whitespace");

    if (!allowed) return;

    const result = input
      .split("\n")
      .map(line => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .join("\n");

    setOutput(result);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={7}
        placeholder="Paste text with messy spaces..."
        style={inputStyle({ resize: "vertical" })}
      />
      <button
        onClick={clean}
        className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        Clean Text
      </button>
      {output && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <CopyBtn text={output} />
          </div>
          <textarea
            readOnly
            value={output}
            rows={7}
            style={inputStyle({
              color: "#7dd3fc",
              background: "rgba(0,10,25,0.8)",
              resize: "vertical"
            })}
          />
        </div>
      )}
    </div>
  );
}

function NumberBaseConverter() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState("255");
  const [base, setBase] = useState(10);
  const [results, setResults] = useState<[string, string][] | null>(null);

  const convert = async () => {
    const allowed = await trackToolUse?.("numberbase");
    if (!allowed) return;

    try {
      const parsed = parseInt(input.trim(), base);

      if (!Number.isFinite(parsed)) {
        setResults(null);
        return;
      }

      setResults([
        ["Binary", parsed.toString(2)],
        ["Octal", parsed.toString(8)],
        ["Decimal", parsed.toString(10)],
        ["Hexadecimal", parsed.toString(16).toUpperCase()],
      ]);
    } catch {
      setResults(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <input value={input} onChange={e => setInput(e.target.value)} style={inputStyle()} />
        <select value={base} onChange={e => setBase(Number(e.target.value))} style={inputStyle()}>
          <option value={2}>Binary (2)</option>
          <option value={8}>Octal (8)</option>
          <option value={10}>Decimal (10)</option>
          <option value={16}>Hex (16)</option>
        </select>
      </div>

      <button
        onClick={convert}
        className="w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        Convert
      </button>

      {results && (
        <div className="space-y-2">
          {results.map(([label, val]) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: "rgba(0,15,30,0.6)",
                border: "1px solid rgba(0,200,220,0.1)"
              }}
            >
              <span className="w-24 text-xs font-semibold" style={{ color: "rgba(0,200,220,0.6)" }}>
                {label}
              </span>
              <code className="flex-1 text-sm break-all" style={{ color: "#7dd3fc" }}>
                {val}
              </code>
              <CopyBtn text={val} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonToCsvTool() {
  const trackToolUse = useToolUsage();
  const [input, setInput] = useState('[{"name":"Zhuu","age":18},{"name":"AI","age":99}]');
  const [output, setOutput] = useState("");

  const convert = async () => {
    const allowed = await trackToolUse?.("jsoncsv");
    if (!allowed) return;
    try {
      const data = JSON.parse(input);
      if (!Array.isArray(data) || !data.length || typeof data[0] !== "object") {
        throw new Error();
      }

      const keys = [...new Set(data.flatMap((row: Record<string, unknown>) => Object.keys(row)))];

      const escapeCsv = (value: unknown) => {
        const str = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csv = [
        keys.map(escapeCsv).join(","),
        ...data.map((row: Record<string, unknown>) =>
          keys.map(key => escapeCsv(row[key])).join(",")
        )
      ].join("\n");

      setOutput(csv);
    } catch {
      setOutput("Invalid JSON array");
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={7}
        placeholder='[{"name":"Zhuu","age":18}]'
        style={inputStyle({ resize: "vertical" })}
      />
      <button
        onClick={convert}
        className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
        style={{
          background: "rgba(0,200,220,0.15)",
          border: "1px solid rgba(0,200,220,0.35)",
          color: "#00e5ff"
        }}
      >
        Convert JSON → CSV
      </button>
      {output && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <CopyBtn text={output} />
          </div>
          <textarea
            readOnly
            value={output}
            rows={9}
            style={inputStyle({
              color: "#7dd3fc",
              background: "rgba(0,10,25,0.8)",
              resize: "vertical"
            })}
          />
        </div>
      )}
    </div>
  );
}


const TOOLS = [
  { id: "slug", icon: "🔗", name: "Slug Generator", desc: "Convert text into clean URL slugs", component: <SlugGenerator /> },
  { id: "random", icon: "🎲", name: "Random Number", desc: "Generate random numbers by range", component: <RandomGenerator /> },
  { id: "whitespace", icon: "🧹", name: "Whitespace Cleaner", desc: "Clean spaces and empty lines", component: <WhitespaceCleaner /> },
  { id: "numberbase", icon: "01", name: "Number Base", desc: "Binary, octal, decimal & hex", component: <NumberBaseConverter /> },
  { id: "jsoncsv", icon: "CSV", name: "JSON → CSV", desc: "Convert JSON arrays into CSV", component: <JsonToCsvTool /> },
  { id: "jwt", icon: "🔐", name: "JWT Decoder", desc: "Decode JWT header & payload", component: <JwtDecoder /> },
  { id: "calculator", icon: "🧮", name: "Calculator", desc: "Calculate mathematical expressions", component: <CalculatorTool /> },
  { id: "json",     icon: "{ }",  name: "JSON Formatter",   desc: "Format, validate & minify JSON",   component: <JsonFormatter /> },
  { id: "color",    icon: "🎨",   name: "Color Converter",  desc: "HEX → RGB → HSL conversions",     component: <ColorConverter /> },
  { id: "text",     icon: "Aa",   name: "Text Utilities",   desc: "Word count, case converter & more", component: <TextUtils /> },
  { id: "url",      icon: "🔗",   name: "URL Tools",        desc: "Encode, decode & parse URLs",      component: <UrlTools /> },
  { id: "base64",   icon: "64",   name: "Base64",           desc: "Encode & decode Base64 strings",   component: <Base64Tool /> },
  { id: "password", icon: "🔑",   name: "Password Generator", desc: "Secure, customizable passwords",  component: <PasswordGenerator /> },
  { id: "qr",       icon: "▦",    name: "QR Code",          desc: "Generate QR codes instantly",      component: <QrCodeTool /> },
  { id: "markdown", icon: "Md",   name: "Markdown Preview", desc: "Live Markdown → HTML rendering",   component: <MarkdownPreview /> },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DevToolsPage() {
  const [activeId, setActiveId] = useState("qr");
  const [toolsUsage, setToolsUsage] = useState<{
    used: number;
    bonus: number;
    limit: number;
    remaining: number;
  } | null>(null);
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const watchAd = async (provider: "lootlabs" | "move2link" = "lootlabs") => {
    // Open the tab synchronously, still inside the click's trusted-gesture
    // context — mobile browsers silently block window.open() called after
    // an await, which is why the button used to look like it "did nothing".
    const adTab = window.open("", "_blank", "noopener,noreferrer");

    const token = await getToken();

    if (!token) {
      adTab?.close();
      alert("Silakan login terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/ads/${provider}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "tools",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.shortLink) {
        adTab?.close();
        alert(data?.error || `Gagal membuat link ${provider === "lootlabs" ? "LootLabs" : "Move2link"}.`);
        return;
      }

      if (adTab) {
        adTab.location.href = data.shortLink;
      } else {
        // Popup got blocked anyway (e.g. browser setting) — fall back to a
        // same-tab navigation offer instead of silently failing.
        window.location.href = data.shortLink;
      }
    } catch {
      adTab?.close();
      alert(`Gagal menghubungi server ${provider === "lootlabs" ? "LootLabs" : "Move2link"}.`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadToolsUsage = async () => {
      try {
        if (!isLoaded || !isSignedIn || cancelled) return;
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch(`${API_BASE}/api/usage`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;

        const data = await res.json();

        if (!cancelled) {
          setToolsUsage(data.tools);
        }
      } catch (err) {
        console.error("Gagal mengambil limit Tools:", err);
      }
    };

    loadToolsUsage();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const trackToolUse = useCallback(async (toolId: string): Promise<boolean> => {
    try {
      const token = await getToken();

      if (!token) {
        alert("Silakan login untuk menggunakan Tools.");
        return false;
      }

      const res = await fetch(`${API_BASE}/api/usage/consume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "tools",
          toolId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          if (data.limit) {
            setToolsUsage(data.limit);
          }

          alert("Limit Tools harian kamu sudah habis. Limit akan reset besok.");
        }

        return false;
      }

      setToolsUsage(data);
      return true;
    } catch (err) {
      console.error("Gagal menggunakan limit Tools:", err);
      return false;
    }
  }, [getToken]);

  const activeTool = TOOLS.find(t => t.id === activeId)!;
  const panelRef = useRef<HTMLDivElement>(null);

  const selectTool = (id: string) => {
    setActiveId(id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <ToolUsageContext.Provider value={trackToolUse}>
      <div className="ocean-bg min-h-screen pt-6 pb-28 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black gradient-text mb-2" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>
            Developer Tools
          </h1>
          <p style={{ color: "rgba(0,200,220,0.5)" }}>
            {TOOLS.length} professional web utilities — no installs, no sign-up
          </p>
        </div>

        {/* Tool Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {TOOLS.map(tool => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              name={tool.name}
              desc={tool.desc}
              active={activeId === tool.id}
              onClick={() => selectTool(tool.id)}
            />
          ))}
        </div>

        {/* Daily Tools Limit */}
        {toolsUsage && (
          <div className="mb-6 rounded-2xl p-4" style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  🛠️ Tools Limit
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {toolsUsage.remaining > 0
                    ? `${toolsUsage.remaining} penggunaan tersisa`
                    : "Limit habis"}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-white">
                  {toolsUsage.used} / {toolsUsage.limit}
                </div>
                {toolsUsage.bonus > 0 && (
                  <div className="text-[11px] text-emerald-400">
                    +{toolsUsage.bonus} bonus
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{
                  width: `${toolsUsage.limit > 0
                    ? Math.min(100, Math.round((toolsUsage.remaining / toolsUsage.limit) * 100))
                    : 0}%`,
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
              <span>
                {toolsUsage.remaining > 0
                  ? `${toolsUsage.remaining} kali lagi`
                  : "Limit habis"}
              </span>
              <span>Reset setiap hari</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => watchAd("lootlabs")}
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                🎬 LootLabs
              </button>

              <button
                type="button"
                onClick={() => watchAd("move2link")}
                className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/20"
              >
                🎬 Move2link
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.location.href = "/member"}
              className="mt-2 w-full rounded-xl border border-purple-400/20 bg-purple-400/10 px-3 py-2 text-xs font-medium text-purple-300 transition hover:bg-purple-400/20"
            >
              ⭐ Upgrade Premium
            </button>
          </div>
        )}

        {/* Active Tool Panel */}
        <div
          ref={panelRef}
          className="rounded-2xl p-6"
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
          {activeTool.component}
        </div>
      </div>
    </div>
      </ToolUsageContext.Provider>
  );
}
