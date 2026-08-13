"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Terminal, 
  ShieldCheck, 
  Sparkles, 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check,
  Link2,
  Zap,
  ExternalLink,
  QrCode
} from "lucide-react";

const REQUEST_SNIPPET = `const response = await fetch('https://opayque-three.vercel.app/api/v1/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer osk_live_9f87d6abcdef...'
  },
  body: JSON.stringify({
    order_id: "ORD-8821",
    amount_fiat: 15.00,
    currency: "USD",
    customer_email: "buyer@example.com"
  })
});

const data = await response.json();`;

const RESPONSE_SNIPPET = `{
  "success": true,
  "payment_intent_id": "pi_9938201a",
  "merchant_wallet": "7xKXtg...3b9Y",
  "amount_crypto": "0.075",
  "token": "USDC",
  "fee_split": {
    "merchant_share": "99.5%",
    "opayque_share": "0.5%"
  }
}`;

export default function QuickstartPage() {
  const router = useRouter();
  
  // Navigation & Tab State
  const [activeMode, setActiveMode] = useState<"no-code" | "api">("no-code");
  const [copiedBlock, setCopiedBlock] = useState<"request" | "response" | "link" | null>(null);

  // No-Code Link Generator Form State
  const [productTitle, setProductTitle] = useState("Custom Order / Payment");
  const [amount, setAmount] = useState("15.00");
  const [currency, setCurrency] = useState("USDC");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCopy = (text: string, block: "request" | "response" | "link") => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(block);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    setTimeout(() => {
      const slug = Math.random().toString(36).substring(2, 9);
      const url = `https://opayque-three.vercel.app/pay/lnk_${slug}`;
      setGeneratedLink(url);
      setIsGenerating(false);
    }, 600);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="relative mx-auto flex min-h-screen items-center justify-center p-4 md:p-6">
        <div className="relative w-full max-w-5xl rounded-[3.5rem] border border-white/10 bg-zinc-950/95 p-6 md:p-10 shadow-2xl">
          
          {/* Top Close Button */}
          <button
            type="button"
            onClick={() => router.push("/developer/overview")}
            className="absolute right-6 top-6 md:right-8 md:top-8 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} className="mr-2 inline-block" /> Close
          </button>

          {/* Mode Selector Tabs */}
          <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-white/5 pb-6">
            <button
              onClick={() => setActiveMode("no-code")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                activeMode === "no-code"
                  ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  : "border border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Zap size={14} /> 1-Click Payment Link (No-Code)
            </button>
            <button
              onClick={() => setActiveMode("api")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                activeMode === "api"
                  ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  : "border border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Code2 size={14} /> Developer API &amp; SDK
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            
            {/* Left Column: Context / Descriptions */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Sparkles size={16} /> Quickstart Launchpad
              </div>

              {activeMode === "no-code" ? (
                <>
                  <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
                      Instant Payment Links
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                      Create a direct checkout link or QR code in seconds. No coding, no server setups, and no API keys required.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 1</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Set Details</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Specify your item name and amount in USDC or SOL.</p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 2</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Share Link</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Send the generated URL directly to your buyer or embed it anywhere.</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
                      Integrate In Minutes
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                      Copy-and-paste code blocks, payload structures, and endpoint definitions directly into your codebase.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 1</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Authentication</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Attach secret key <code className="text-purple-400 font-mono">osk_live_...</code> as a Bearer token.</p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 2</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Create Session</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">POST payload to generate an active checkout intent.</p>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link
                  href="/developer/docs"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-purple-500/30 bg-purple-600 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white transition hover:bg-purple-500"
                >
                  <Terminal size={16} /> Full API Ref
                </Link>
                <Link
                  href="/developer/overview"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-white transition hover:border-purple-500/40 hover:bg-white/10"
                >
                  <ShieldCheck size={16} /> Developer Hub
                </Link>
              </div>
            </div>

            {/* Right Column: Dynamic Interactive Area */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/80 p-6 md:p-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_40%)]" />
              
              {activeMode === "no-code" ? (
                /* NO-CODE PAYMENT LINK GENERATOR INTERFACE */
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 text-purple-300">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                      <Link2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">No-Code Tool</p>
                      <p className="text-sm font-black uppercase tracking-[0.1em] text-white">Payment Link Generator</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerateLink} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">
                        Product / Payment Label
                      </label>
                      <input
                        type="text"
                        value={productTitle}
                        onChange={(e) => setProductTitle(e.target.value)}
                        placeholder="e.g. Custom Merchandise"
                        className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs font-medium text-white transition focus:border-purple-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="15.00"
                          className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs font-medium text-white transition focus:border-purple-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">
                          Asset Token
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs font-medium text-white transition focus:border-purple-500 focus:outline-none"
                        >
                          <option value="USDC">USDC (Solana)</option>
                          <option value="SOL">SOL (Native)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isGenerating}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-purple-600 py-3.5 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-purple-500 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isGenerating ? "Generating Unique URL..." : "🪄 Generate Payment Link"}
                    </button>
                  </form>

                  {/* Generated Link Display Card */}
                  {generatedLink && (
                    <div className="mt-6 space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                          <CheckCircle2 size={12} /> Active Hosted Link
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">{currency} Settlement</span>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/80 p-3 flex items-center justify-between gap-2">
                        <code className="text-[11px] font-mono text-emerald-300 truncate">
                          {generatedLink}
                        </code>
                        <button
                          onClick={() => handleCopy(generatedLink, "link")}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition shrink-0"
                        >
                          {copiedBlock === "link" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-white/10"
                        >
                          <ExternalLink size={12} /> Open Test Checkout
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* DEVELOPER API SNIPPETS INTERFACE */
                <div className="relative space-y-4">
                  <div className="flex items-center gap-3 text-purple-300">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-purple-500/10">
                      <Code2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Endpoint Reference</p>
                      <p className="text-sm font-black uppercase tracking-[0.1em] text-white">POST /api/v1/sessions</p>
                    </div>
                  </div>

                  {/* Node.js Request Snippet */}
                  <div className="rounded-[2rem] border border-white/10 bg-black/60 p-5 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">
                        1. Request Example (Node.js)
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(REQUEST_SNIPPET, "request")}
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400 transition hover:text-white"
                      >
                        {copiedBlock === "request" ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed text-zinc-300">
                      <code>{REQUEST_SNIPPET}</code>
                    </pre>
                  </div>

                  {/* JSON Response Snippet */}
                  <div className="rounded-[2rem] border border-white/10 bg-black/60 p-5 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">
                          2. Expected JSON Response
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(RESPONSE_SNIPPET, "response")}
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400 transition hover:text-white"
                      >
                        {copiedBlock === "response" ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed text-emerald-400/90">
                      <code>{RESPONSE_SNIPPET}</code>
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
