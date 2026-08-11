"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, ShieldCheck, Sparkles } from "lucide-react";

export default function QuickstartPage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="relative mx-auto flex min-h-screen items-center justify-center p-6">
        <div className="relative w-full max-w-4xl rounded-[4rem] border border-white/10 bg-zinc-950/95 p-10 shadow-2xl">
          <button
            type="button"
            onClick={() => router.push("/developer")}
            className="absolute right-8 top-8 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} className="inline-block mr-2" /> Return
          </button>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Sparkles size={16} /> Developer Quickstart
              </div>
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-white">Launch Sandbox Fast</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                  This quickstart page is designed like the hardware fleet popup in the vault registry: centered, immersive, and focused on your next action.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 1</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">Open sandbox mode</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">Run a developer sandbox flow immediately and validate your checkout integration.</p>
                </div>
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 2</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">Keep the hub close</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">Return to the developer portal any time from the dock if you need to adjust environment or session settings.</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link
                  href="/sandbox"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-purple-500/30 bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:bg-purple-500"
                >
                  <Zap size={18} /> Launch Sandbox
                </Link>
                <Link
                  href="/developer"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:border-purple-500/40 hover:bg-white/10"
                >
                  <ShieldCheck size={18} /> Open Developer Hub
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-900/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_30%)]" />
              <div className="relative space-y-6">
                <div className="flex items-center gap-3 text-purple-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-purple-500/10">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Quickstart status</p>
                    <p className="text-sm font-black uppercase tracking-[0.1em] text-white">Ready for sandbox deployment</p>
                  </div>
                </div>
                <div className="rounded-[2rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Hardware Fleet Pop-up</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">This layout mirrors the focused registry overlay from the vault experience, with clean action cards and a single task-first path.</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Next action</p>
                    <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white">Sandbox checkout</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-zinc-950/70 px-5 py-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Focus</p>
                    <p className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white">No API key distractions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
