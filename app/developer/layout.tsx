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
  LayoutDashboard,
  Webhook,
} from "lucide-react";
import { clearActiveSession } from "@/lib/crypto/session";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<"keys" | "quickstart" | null>(null);

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
              onClick={() => setActiveModal("keys")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition hover:border-purple-500/40 hover:text-white"
            >
              <Key size={14} /> API_KEYS
            </button>
            <button
              type="button"
              onClick={() => setActiveModal("quickstart")}
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] transition hover:bg-purple-500"
            >
              <Zap size={14} /> QUICKSTART
            </button>
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

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-zinc-950 p-8 shadow-[0_0_25px_rgba(168,85,247,0.35)]">
            <button type="button" onClick={() => setActiveModal(null)} className="absolute right-6 top-6 rounded-2xl border border-white/10 p-2 text-zinc-500 transition hover:text-white" aria-label="Close modal"><X size={18} /></button>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-purple-400">Developer Hub</p>
            <h2 className="mt-3 text-3xl font-black italic uppercase tracking-tighter">{activeModal === "keys" ? "API Keys" : "Quickstart"}</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">{activeModal === "keys" ? "Manage your API credentials from the dedicated keys workspace." : "Start with the sandbox, configure your endpoint, and send your first protected request."}</p>
            <Link href={activeModal === "keys" ? "/developer/keys" : "/developer/sandbox"} onClick={() => setActiveModal(null)} className="mt-8 inline-flex w-full justify-center rounded-2xl bg-purple-600 px-6 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-white transition hover:bg-purple-500">Open Workspace</Link>
          </div>
        </div>
      )}
    </div>
  );
}
