"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Code2,
  Key,
  Lock,
  X,
  Zap,
  Wrench,
  LayoutDashboard,
  Webhook,
} from "lucide-react";
import OpayqueCheckout from "@/components/OpayqueCheckout";
import { clearActiveSession } from "@/lib/crypto/session";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<"quickstart" | "sandbox" | null>(null);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);

  const lockDeveloperHub = () => {
    clearActiveSession();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black px-6 py-6 text-white selection:bg-purple-500/30">
      <div className="fixed inset-0 pointer-events-none bg-purple-500/5" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-12 flex flex-col gap-6 border-b border-white/5 pb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-purple-500/20 bg-zinc-900 text-purple-400 shadow-inner">
              <Code2 size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">
                Opayque <span className="text-purple-500">//</span> Dev_Hub
              </h1>
              <p className="mt-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Developer session active
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={lockDeveloperHub}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 transition hover:border-red-500/30 hover:text-red-400"
            >
              <Lock size={14} /> Lock Hub
            </button>
          </div>
        </header>

        <nav className="mb-10 flex w-full overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 backdrop-blur-md">
          <Link
            href="/developer/overview"
            className={`flex min-w-fit items-center gap-2 rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${pathname.startsWith("/developer/overview") ? "bg-white text-black shadow-xl shadow-white/5" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}
          >
            <LayoutDashboard size={14} /> Overview
          </Link>
          <Link
            href="/developer/webhooks-delivery-logs"
            className={`flex min-w-fit items-center gap-2 rounded-xl px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${pathname.startsWith("/developer/webhooks-delivery-logs") ? "bg-white text-black shadow-xl shadow-white/5" : "text-zinc-500 hover:bg-white/5 hover:text-white"}`}
          >
            <Webhook size={14} /> Webhooks &amp; Delivery Logs
          </Link>
        </nav>

        <main>{children}</main>

        <footer className="mt-20 flex items-center justify-between border-t border-white/5 pt-8 opacity-30">
          <p className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">Powered by Solana TEE Infrastructure</p>
          <div className="flex gap-4"><span className="h-2 w-2 rounded-full bg-green-500" /><span className="h-2 w-2 rounded-full bg-purple-500" /></div>
        </footer>
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <div className={`flex flex-col items-end gap-3 overflow-hidden transition-[max-height,opacity] duration-300 ${isSpeedDialOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
          <button
            type="button"
            onClick={() => {
              setActiveModal('sandbox');
              setIsSpeedDialOpen(false);
            }}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-zinc-900/95 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-[0_15px_40px_rgba(0,0,0,0.45)] transition-all hover:-translate-y-0.5 hover:border-purple-500/40 hover:bg-white/5 active:scale-[0.98]"
          >
            <span>Sandbox Checkout</span>
            <Zap size={16} className="text-purple-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveModal('quickstart');
              setIsSpeedDialOpen(false);
            }}
            className="group flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-purple-700/95 px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-[0_15px_40px_rgba(80,0,140,0.35)] transition-all hover:-translate-y-0.5 hover:border-purple-300/50 hover:bg-purple-600/90 active:scale-[0.98]"
          >
            <span>Quickstart / API Keys</span>
            <Key size={16} className="text-white" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsSpeedDialOpen((current) => !current)}
          aria-expanded={isSpeedDialOpen}
          aria-label="Toggle developer quick actions"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/90 text-white shadow-[0_30px_70px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          {isSpeedDialOpen ? <X size={24} /> : <Wrench size={24} />}
        </button>
      </div>

      {activeModal === 'quickstart' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-zinc-950 p-8 shadow-[0_0_25px_rgba(168,85,247,0.35)]">
            <button type="button" onClick={() => setActiveModal(null)} className="absolute right-6 top-6 rounded-2xl border border-white/10 p-2 text-zinc-500 transition hover:text-white" aria-label="Close modal"><X size={18} /></button>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-purple-400">Developer Hub</p>
            <h2 className="mt-3 text-3xl font-black italic uppercase tracking-tighter">Quickstart Tools</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">Launch the developer onboarding workspace or inspect your API credentials from anywhere inside the hub.</p>
            <div className="mt-8 grid gap-4">
              <Link href="/developer/keys" onClick={() => setActiveModal(null)} className="inline-flex w-full items-center justify-between rounded-3xl border border-purple-600/40 bg-purple-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_25px_rgba(168,85,247,0.25)] transition hover:bg-purple-500">
                <span>API Keys Workspace</span>
                <X className="opacity-0" />
              </Link>
              <Link href="/developer/sandbox" onClick={() => setActiveModal(null)} className="inline-flex w-full items-center justify-between rounded-3xl border border-white/10 bg-zinc-900 px-6 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-white transition hover:border-purple-500/40 hover:bg-white/5">
                <span>Open Sandbox Page</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'sandbox' && (
        <OpayqueCheckout
          apiKey="opq_sandbox_demo_key"
          orderId="DEV-SANDBOX-001"
          amountUsdc={19.99}
          merchantWallet="BPFLoaderTest11111111111111111111111"
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
