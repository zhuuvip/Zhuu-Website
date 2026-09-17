import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  CreditCard,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import RankBadge, { type RankType } from "@/components/RankBadge";

const QUICK_AMOUNTS = [1000, 25000, 50000, 10000, 250000];
const QRIS_CODE = "/attached_assets/IMG_20260917_085309.jpg";

const formatRupiah = (value: number) => `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const LEADERBOARD = [
  { name: "Naya Ocean", handle: "@naya", rank: "trench" as RankType, points: "12.840", initials: "NO", color: "#c084fc" },
  { name: "Raka Deep", handle: "@raka", rank: "trench" as RankType, points: "10.420", initials: "RD", color: "#00e5ff" },
  { name: "Zio Abyss", handle: "@zio", rank: "deep-sea" as RankType, points: "8.960", initials: "ZA", color: "#38bdf8" },
  { name: "Mira Tide", handle: "@mira", rank: "deep-sea" as RankType, points: "7.320", initials: "MT", color: "#818cf8" },
  { name: "Ardan Reef", handle: "@ardan", rank: "surface" as RankType, points: "5.180", initials: "AR", color: "#22d3ee" },
];

function BalanceCard({ balance }: { balance: number }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] p-6 glass-card" style={{ background: "linear-gradient(135deg, rgba(0,229,255,.12), rgba(192,132,252,.07) 60%, rgba(7,15,30,.78))" }}>
      <div className="absolute -right-12 -top-16 size-40 rounded-full border border-cyan-300/10" />
      <div className="absolute -right-4 -top-8 size-24 rounded-full border border-cyan-300/10" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-cyan-100/55"><Wallet className="size-4" /> Current balance</div>
          <div className="text-3xl font-black tracking-tight gradient-text">{formatRupiah(balance)}</div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300/75"><ShieldCheck className="size-3.5" /> Saldo aman & terenkripsi</div>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-cyan-300"><CreditCard className="size-5" /></div>
      </div>
    </div>
  );
}

function TopUpFlow() {
  const { getToken } = useAuth();
  const [step, setStep] = useState<"choose" | "waiting" | "success">("choose");
  const [amount, setAmount] = useState(50000);
  const [custom, setCustom] = useState("");
  const [checking, setChecking] = useState(false);
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [seconds, setSeconds] = useState(900);
  const [balance, setBalance] = useState(0);
  const [animatedBalance, setAnimatedBalance] = useState(0);
  const [depositRef, setDepositRef] = useState("");
  const [currentDepositId, setCurrentDepositId] = useState<number | null>(null);
  const [qrUrl, setQrUrl] = useState("");

  const selectedAmount = custom ? Number(custom.replace(/\D/g, "")) : amount;
  const newBalance = balance + selectedAmount;

  useEffect(() => {
    let cancelled = false;

    const loadBalance = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch(`${API_BASE}/api/wallet`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && !cancelled) {
          setBalance(Number(data.balance || 0));
        }
      } catch {
        // Saldo tetap 0 jika gagal mengambil data.
      }
    };

    loadBalance();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (step !== "waiting" || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearInterval(timer);
  }, [step, seconds]);

  useEffect(() => {
    if (!paymentChecked || !currentDepositId || step !== "waiting") return;

    let cancelled = false;
    let notified = false;

    const checkDepositStatus = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch(`${API_BASE}/api/wallet/transactions`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok || cancelled) return;

        const transactions = await res.json();
        const transaction = transactions.find(
          (item: any) => Number(item.id) === currentDepositId
        );

        if (!transaction || notified || cancelled) return;

        if (transaction.status === "PAID") {
          notified = true;

          const walletRes = await fetch(`${API_BASE}/api/wallet`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (walletRes.ok) {
            const walletData = await walletRes.json();
            setBalance(Number(walletData.balance || 0));
          }

          setStep("success");
          alert("Pembayaran berhasil. Saldo kamu sudah bertambah.");
        }

        if (transaction.status === "REJECTED") {
          notified = true;
          alert(
            "Kamu belum membayar. Silakan hubungi nomor admin untuk bertanya."
          );
          setStep("choose");
          setPaymentChecked(false);
          setCurrentDepositId(null);
        }
      } catch {}
    };

    checkDepositStatus();
    const interval = window.setInterval(checkDepositStatus, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [paymentChecked, currentDepositId, step, getToken]);

  useEffect(() => {
    if (step !== "success") return;

    const start = Math.max(0, balance - selectedAmount);
    const target = balance;
    const difference = target - start;
    let frame = 0;
    const totalFrames = 36;

    const timer = window.setInterval(() => {
      frame += 1;
      setAnimatedBalance(
        Math.round(start + difference * (frame / totalFrames))
      );

      if (frame >= totalFrames) {
        setAnimatedBalance(target);
        window.clearInterval(timer);
      }
    }, 24);

    return () => window.clearInterval(timer);
  }, [step, balance, selectedAmount]);

  const timerLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const progress = (seconds / 900) * 100;

  const checkPayment = async () => {
    if (paymentChecked || checking) return;

    try {
      setChecking(true);

      const token = await getToken();
      if (!token) {
        alert("Silakan login terlebih dahulu.");
        setChecking(false);
        return;
      }

      if (!currentDepositId) {
        throw new Error("Transaksi deposit tidak ditemukan.");
      }

      const checkRes = await fetch(
        `${API_BASE}/api/wallet/transactions/${currentDepositId}/check`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok) {
        throw new Error(checkData.error || "Gagal mengecek pembayaran");
      }

      const walletRes = await fetch(`${API_BASE}/api/wallet`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const walletData = await walletRes.json().catch(() => ({}));

      if (walletRes.ok) {
        setBalance(Number(walletData.balance || 0));
      }

      setChecking(false);
      setPaymentChecked(true);

      alert(
        "Deposit masih PENDING.\n\n" +
        "Saldo akan bertambah setelah deposit dikonfirmasi admin."
      );
    } catch (error) {
      setChecking(false);
      alert(error instanceof Error ? error.message : "Gagal mengecek pembayaran.");
    }
  };

  if (step === "waiting") {
    return (
      <div className="glass-card rounded-[24px] p-5 text-center sm:p-7">
        <div className="mb-5 flex items-center justify-between text-left"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300/45">Payment request</p><h3 className="mt-1 text-lg font-bold text-cyan-50">Scan untuk membayar</h3></div><button onClick={() => setStep("choose")} className="rounded-full p-2 text-cyan-200/60 hover:bg-cyan-300/10 hover:text-cyan-200" aria-label="Close payment"><X className="size-4" /></button></div>
        <div className="mx-auto mb-5 max-w-[260px] rounded-[22px] border border-cyan-300/40 bg-cyan-50 p-3 shadow-[0_0_28px_rgba(0,229,255,.18)]" style={{ animation: "qr-pulse 2.4s ease-in-out infinite" }}><img src={qrUrl || QRIS_CODE} alt="QRIS payment code" className="aspect-square w-full rounded-xl" /></div>
        {depositRef && (
          <div className="mb-4 rounded-xl border border-cyan-300/10 bg-cyan-300/5 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-cyan-100/35">
              Deposit Reference
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-cyan-200">
              {depositRef}
            </p>
          </div>
        )}
        <div className="mb-5 flex items-center justify-center gap-3 text-xs text-cyan-100/60"><div className="relative flex size-10 items-center justify-center rounded-full border border-cyan-300/20"><svg className="absolute inset-[-3px] size-12 -rotate-90"><circle cx="24" cy="24" r="21" fill="none" stroke="rgba(0,229,255,.12)" strokeWidth="2" /><circle cx="24" cy="24" r="21" fill="none" stroke="#00e5ff" strokeWidth="2" strokeDasharray="132" strokeDashoffset={132 - 132 * (progress / 100)} strokeLinecap="round" /></svg><span className="font-mono text-[10px] text-cyan-200">{Math.ceil(seconds / 60)}m</span></div><span>Berlaku sampai <b className="font-mono text-cyan-200">{timerLabel}</b></span></div>
        <div className="mb-6 flex justify-center gap-2 text-[10px] text-cyan-100/45"><span className="rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-2 py-1">GoPay</span><span className="rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-2 py-1">OVO</span><span className="rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-2 py-1">DANA</span><span className="rounded-lg border border-cyan-300/10 bg-cyan-300/5 px-2 py-1">QRIS</span></div>
        <button
  onClick={async () => {
    if (paymentChecked || checking || !currentDepositId) return;

    try {
      setChecking(true);

      const token = await getToken();
      if (!token) {
        alert("Silakan login terlebih dahulu.");
        setChecking(false);
        return;
      }

      const checkRes = await fetch(
        `${API_BASE}/api/wallet/transactions/${currentDepositId}/check`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const checkData = await checkRes.json().catch(() => ({}));

      if (!checkRes.ok) {
        throw new Error(checkData.error || "Gagal mengirim verifikasi");
      }

      setChecking(false);
      setPaymentChecked(true);

      const message = [
        "Halo Admin Zhuu Shop 👋",
        "",
        "Saya ingin konfirmasi deposit.",
        "",
        `💰 Nominal: ${formatRupiah(selectedAmount)}`,
        `🧾 Ref: ${depositRef}`,
        "",
        "Pembayaran sudah saya lakukan melalui QRIS.",
        "Mohon dicek dan dikonfirmasi.",
        "",
        "Terima kasih, Admin 🙏",
      ].join(String.fromCharCode(10));

      window.open(
        `https://wa.me/62882005730502?text=${encodeURIComponent(message)}`,
        "_blank"
      );
    } catch (error) {
      setChecking(false);
      alert(
        error instanceof Error
          ? error.message
          : "Gagal mengirim verifikasi."
      );
    }
  }}
  disabled={checking || paymentChecked}
  className="neon-btn-solid flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-70"
>
  {checking ? "Mengirim verifikasi..." : paymentChecked ? "Verifikasi Terkirim" : "Kirim Verifikasi WhatsApp"}
</button>
        <button onClick={() => setStep("choose")} className="mt-4 text-xs text-cyan-100/45 underline-offset-4 hover:text-cyan-200 hover:underline">Batal, top up jumlah lain</button>
      </div>
    );
  }

  if (step === "success") {
    return <div className="glass-card rounded-[24px] p-8 text-center"><div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 shadow-[0_0_40px_rgba(52,211,153,.3)]"><Check className="size-10 text-emerald-300" /></div><p className="text-xs uppercase tracking-[.2em] text-emerald-300/60">Transaction complete</p><h3 className="mt-2 text-2xl font-black text-cyan-50">Saldo berhasil ditambahkan!</h3><p className="mt-2 text-lg font-bold text-cyan-300">+{formatRupiah(selectedAmount)}</p><div className="my-7 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-4"><span className="text-xs text-cyan-100/45">Saldo baru</span><div className="mt-1 text-2xl font-black gradient-text">{formatRupiah(animatedBalance)}</div></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/portfolio" className="neon-btn-solid flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-bold">Lihat Role Shop <ChevronRight className="ml-1 size-4" /></Link><button onClick={() => setStep("choose")} className="neon-btn flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-bold">Kembali ke Wallet</button></div></div>;
  }

  return <div className="flex flex-col gap-5"><BalanceCard balance={balance} /><div className="glass-card rounded-[24px] p-5 sm:p-7"><div className="mb-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300/45">Auto QRIS</p><h3 className="mt-1 text-xl font-bold text-cyan-50">Pilih nominal top up</h3></div><Zap className="size-5 text-cyan-300" /></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{QUICK_AMOUNTS.map((quick) => <button key={quick} onClick={() => { setAmount(quick); setCustom(""); }} className={`rounded-xl border px-2 py-3 text-sm font-bold transition-all ${!custom && amount === quick ? "border-cyan-300 bg-cyan-300/15 text-cyan-200 shadow-[0_0_18px_rgba(0,229,255,.16)]" : "border-cyan-300/15 bg-cyan-300/5 text-cyan-100/60 hover:border-cyan-300/40 hover:text-cyan-200"}`}>{formatRupiah(quick).replace("Rp", "")}</button>)}</div><label className="mt-5 block text-xs text-cyan-100/45" htmlFor="custom-amount">Nominal custom</label><div className="relative mt-2"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-cyan-100/45">Rp</span><input id="custom-amount" value={custom ? new Intl.NumberFormat("id-ID").format(Number(custom.replace(/\D/g, ""))) : ""} onChange={(event) => setCustom(event.target.value)} placeholder="Masukkan nominal lain" className="w-full rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-3 pl-11 text-sm text-cyan-100 outline-none placeholder:text-cyan-100/25 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10" inputMode="numeric" /></div><button onClick={async () => {
              if (selectedAmount < 1000) return;

              try {
                const token = await getToken();
                if (!token) {
                  alert("Silakan login terlebih dahulu.");
                  return;
                }

                setChecking(true);
                setPaymentChecked(false);

                const res = await fetch(`${API_BASE}/api/wallet/deposit`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ amount: selectedAmount }),
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                  throw new Error(data.error || "Gagal membuat deposit");
                }

                setDepositRef(data.transaction?.reference || "");
                setCurrentDepositId(Number(data.transaction?.id || 0));
      setQrUrl(data.qrUrl || "");
                setChecking(false);
                setSeconds(900);
                setStep("waiting");
              } catch (error) {
                setChecking(false);
                alert(error instanceof Error ? error.message : "Gagal membuat deposit.");
              }
            }} disabled={selectedAmount < 1000} className="neon-btn-solid mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold disabled:cursor-not-allowed disabled:opacity-40">Top Up {formatRupiah(selectedAmount)} <ChevronRight className="size-4" /></button><p className="mt-3 text-center text-[11px] text-cyan-100/35">Minimal Rp1.000 · via QRIS (semua e-wallet & bank)</p></div></div>;
}

function RankSection() {
  const current = 6420;
  const next = 1000;
  return <div className="flex flex-col gap-5"><div className="glass-card rounded-[24px] p-5 sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300/45">Member rank</p><h3 className="mt-1 text-xl font-bold text-cyan-50">Progress kamu</h3></div><RankBadge rank="deep-sea" size="large" /></div><div className="mt-6 flex items-center justify-between"><div><p className="text-xs text-cyan-100/45">Rank saat ini</p><RankBadge rank="deep-sea" showLabel size="medium" /></div><div className="text-right"><p className="text-xs text-cyan-100/45">Next rank</p><RankBadge rank="trench" showLabel size="small" /></div></div><div className="mt-6"><div className="mb-2 flex justify-between text-xs"><span className="text-cyan-200">{current.toLocaleString("id-ID")} XP</span><span className="text-cyan-100/40">10.000 XP</span></div><div className="h-2 overflow-hidden rounded-full bg-cyan-300/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_14px_rgba(0,229,255,.55)]" style={{ width: `${(current / next) * 100}%` }} /></div><p className="mt-3 flex items-center gap-2 text-xs text-cyan-100/45"><LockKeyhole className="size-3.5 text-purple-300" /> Butuh 3.580 XP lagi · aktifkan streak harian untuk naik rank</p></div></div><div className="glass-card rounded-[24px] p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-cyan-300/45">Community status</p><h3 className="mt-1 text-xl font-bold text-cyan-50">Deep Divers</h3></div><Trophy className="size-5 text-purple-300" /></div><div className="flex flex-col gap-2">{LEADERBOARD.map((member, index) => <div key={member.name} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors hover:bg-cyan-300/5 ${index === 0 ? "border-purple-300/30 bg-purple-300/5" : index === 1 ? "border-cyan-300/25 bg-cyan-300/5" : "border-cyan-300/10 bg-cyan-300/[.02]"}`}><div className="flex w-5 justify-center text-sm font-black text-cyan-100/35">{index === 0 ? <Crown className="size-4 text-yellow-300" /> : `0${index + 1}`}</div><div className="flex size-9 items-center justify-center rounded-full border text-xs font-bold" style={{ borderColor: `${member.color}66`, background: `${member.color}18`, color: member.color }}>{member.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-cyan-50">{member.name}</p><p className="text-[11px] text-cyan-100/35">{member.handle}</p></div><RankBadge rank={member.rank} size="small" /><span className="w-16 text-right font-mono text-xs font-bold text-cyan-200">{member.points}</span></div>)}</div><button className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-semibold text-cyan-300/65 hover:text-cyan-200">Lihat leaderboard lengkap <ChevronRight className="size-3.5" /></button></div></div>;
}

export default function MemberPage() {
  const [tab, setTab] = useState<"topup" | "rank">("topup");
  return <main className="ocean-bg min-h-screen px-4 pb-28 pt-24"><div className="mx-auto max-w-xl page-enter"><Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/45 transition-colors hover:text-cyan-200"><ArrowLeft className="size-4" /> Kembali ke home</Link><div className="mb-7"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.25em] text-cyan-300/55"><Sparkles className="size-3.5" /> ZhuuVIP Member</div><h1 className="text-balance text-3xl font-black leading-tight text-cyan-50 sm:text-4xl" style={{ fontFamily: "Poppins, Inter, sans-serif" }}>Wallet & <span className="gradient-text">Member Rank</span></h1><p className="mt-3 max-w-md text-sm leading-6 text-cyan-100/45">Isi saldo instan dengan QRIS dan naikkan statusmu di dunia bawah laut ZhuuVIP.</p></div><div className="mb-5 grid grid-cols-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[.03] p-1"><button onClick={() => setTab("topup")} className={`rounded-lg py-2.5 text-sm font-bold transition-all ${tab === "topup" ? "bg-cyan-300/15 text-cyan-200 shadow-[0_0_14px_rgba(0,229,255,.1)]" : "text-cyan-100/40 hover:text-cyan-100/70"}`}>Top Up Saldo</button><button onClick={() => setTab("rank")} className={`rounded-lg py-2.5 text-sm font-bold transition-all ${tab === "rank" ? "bg-purple-300/15 text-purple-200 shadow-[0_0_14px_rgba(192,132,252,.12)]" : "text-cyan-100/40 hover:text-cyan-100/70"}`}>Rank Member</button></div>{tab === "topup" ? <TopUpFlow /> : <RankSection />}</div></main>;
}

