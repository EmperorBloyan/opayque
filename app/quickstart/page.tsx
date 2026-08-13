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
  Code
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
  
  const [activeMode, setActiveMode] = useState<"no-code" | "api">("no-code");
  const [copiedBlock, setCopiedBlock] = useState<"request" | "response" | "link" | "embed" | null>(null);

  // Generator Form State
  const [productTitle, setProductTitle] = useState("Custom Order / Payment");
  const [amount, setAmount] = useState("15.00");
  const [currency, setCurrency] = useState("USDC");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedEmbed, setGeneratedEmbed] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCopy = (text: string, block: "request" | "response" | "link" | "embed") => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(block);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    setTimeout(() => {
      const slug = Math.random().toString(36).substring(2, 9);
      const url = `https://opayque-three.vercel.app/pay/lnk_${slug}`;
      const embedCode = `<!-- Opayque Pay Button -->\n<script src="https://opayque-three.vercel.app/v1/checkout.js" data-amount="${amount}" data-token="${currency}"></script>\n<button onclick="Opayque.checkout('${slug}')" style="background:#a855f7;color:#fff;padding:12px 24px;border-radius:12px;font-weight:bold;border:none;cursor:pointer;">\n  Pay $${amount} with ${currency}\n</button>`;
      
      setGeneratedLink(url);
      setGeneratedEmbed(embedCode);
      setIsGenerating(false);
    }, 500);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="relative mx-auto flex min-h-screen items-center justify-center p-4 md:p-6">
        <div className="relative w-full max-w-5xl rounded-[3.5rem] border border-white/10 bg-zinc-950/95 p-6 md:p-10 shadow-2xl">
          
          <button
            type="button"
            onClick={() => router.push("/developer/overview")}
            className="absolute right-6 top-6 md:right-8 md:top-8 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} className="mr-2 inline-block" /> Close
          </button>

          {/* Mode Tabs */}
          <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-white/5 pb-6">
            <button
              onClick={() => setActiveMode("no-code")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition ${
                activeMode === "no-code"
                  ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                  : "border border-white/10 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              <Zap size={14} /> No-Code Link &amp; Button Generator
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
            
            {/* Left Instructions */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Sparkles size={16} /> Quickstart Launchpad
              </div>

              {activeMode === "no-code" ? (
                <>
                  <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">
                      Links &amp; Pay Buttons
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                      Generate shareable payment URLs or embeddable HTML checkout button snippets to paste onto any website without writing backend code.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Option A</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Direct Link</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Share on social media or send in chat DMs.</p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Option B</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">HTML Widget</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Paste code into WordPress, Wix, or custom site.</p>
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
                      <p className="mt-2 text-xs leading-5 text-zinc-400">Attach secret key as Bearer token.</p>
                    </div>
                    <div className="rounded-[2rem] border border-white/10 bg-black/50 p-5">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 2</p>
                      <p className="mt-2 text-base font-black uppercase tracking-[0.1em] text-white">Create Session</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">POST payload to generate payment intent.</p>
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

            {/* Right Panel */}
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/80 p-6 md:p-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_40%)]" />
              
              {activeMode === "no-code" ? (
                <div className="relative space-y-6">
                  <div className="flex items-center gap-3 text-purple-300">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                      <Link2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">No-Code Generator</p>
                      <p className="text-sm font-black uppercase tracking-[0.1em] text-white">Checkout Link &amp; Button</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerate} className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">
                        Product / Service Label
                      </label>
                      <input
                        type="text"
                        value={productTitle}
                        onChange={(e) => setProductTitle(e.target.value)}
                        placeholder="e.g. Custom Denim Jacket"
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
                          Settlement Token
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
                      {isGenerating ? "Building Checkout Assets..." : "🪄 Generate Link & Embed Code"}
                    </button>
                  </form>

                  {/* Outputs */}
                  {generatedLink && generatedEmbed && (
                    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      
                      {/* Output 1: Direct Link */}
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                            <CheckCircle2 size={12} /> 1. Hosted Link
                          </span>
                          <a href={generatedLink} target="_blank" rel="noreferrer" className="text-[9px] text-zinc-400 hover:text-white flex items-center gap-1">
                            Test <ExternalLink size={10} />
                          </a>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/80 p-2.5 flex items-center justify-between gap-2">
                          <code className="text-[10px] font-mono text-emerald-300 truncate">{generatedLink}</code>
                          <button onClick={() => handleCopy(generatedLink, "link")} className="text-zinc-300 hover:text-white shrink-0">
                            {copiedBlock === "link" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Output 2: Embeddable Code */}
                      <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-purple-400">
                            <Code size={12} /> 2. HTML Pay Button Snippet
                          </span>
                          <button onClick={() => handleCopy(generatedEmbed, "embed")} className="text-[10px] font-bold text-purple-300 hover:text-white flex items-center gap-1">
                            {copiedBlock === "embed" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            {copiedBlock === "embed" ? "Copied Snippet" : "Copy Code"}
                          </button>
                        </div>
                        <pre className="rounded-xl border border-white/10 bg-black/80 p-3 text-[10px] font-mono text-purple-200/80 overflow-x-auto max-h-28">
                          <code>{generatedEmbed}</code>
                        </pre>
                      </div>

                    </div>
                  )}
                </div>
              ) : (
                /* Developer API Snippets */
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

                  <div className="rounded-[2rem] border border-white/10 bg-black/60 p-5 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">1. Request Example (Node.js)</p>
                      <button type="button" onClick={() => handleCopy(REQUEST_SNIPPET, "request")} className="inline-flex items-center gap-1 text-[10px] uppercase text-zinc-400 hover:text-white">
                        {copiedBlock === "request" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono leading-relaxed text-zinc-300">
                      <code>{REQUEST_SNIPPET}</code>
                    </pre>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-black/60 p-5 overflow-x-auto">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">2. Expected JSON Response</p>
                      </div>
                      <button type="button" onClick={() => handleCopy(RESPONSE_SNIPPET, "response")} className="inline-flex items-center gap-1 text-[10px] uppercase text-zinc-400 hover:text-white">
                        {copiedBlock === "response" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
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
