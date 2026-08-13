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
  Check 
} from "lucide-react";

const REQUEST_SNIPPET = `const response = await fetch('https://opayque.com/api/v1/sessions', {
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
  const [copiedBlock, setCopiedBlock] = useState<"request" | "response" | null>(null);

  const handleCopy = (text: string, block: "request" | "response") => {
    navigator.clipboard.writeText(text);
    setCopiedBlock(block);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="relative mx-auto flex min-h-screen items-center justify-center p-6">
        <div className="relative w-full max-w-5xl rounded-[4rem] border border-white/10 bg-zinc-950/95 p-10 shadow-2xl">
          <button
            type="button"
            onClick={() => router.push("/developer/overview")}
            className="absolute right-8 top-8 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={16} className="mr-2 inline-block" /> Close
          </button>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            {/* Left Column: Instructions */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-purple-300">
                <Sparkles size={16} /> API Quickstart & Docs
              </div>
              <div>
                <h1 className="text-5xl font-black uppercase tracking-tighter text-white">
                  Integrate In Minutes
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                  Copy-and-paste code blocks, payload structures, and endpoint definitions right where you manage your API keys. No hunting through external docs.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 1</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">
                    Authentication
                  </p>
                  <p className="mt-3 text-xs leading-6 text-zinc-400">
                    Attach your <code className="text-purple-400 font-mono">osk_live_...</code> secret key to your HTTP requests via the Authorization header as a Bearer token.
                  </p>
                </div>
                <div className="rounded-[2.5rem] border border-white/10 bg-black/50 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Step 2</p>
                  <p className="mt-3 text-lg font-black uppercase tracking-[0.1em] text-white">
                    Create Session
                  </p>
                  <p className="mt-3 text-xs leading-6 text-zinc-400">
                    Send a POST request to our sessions endpoint to generate a unique crypto payment intent for your frontend to render.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link
                  href="/developer/docs"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-purple-500/30 bg-purple-600 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:bg-purple-500"
                >
                  <Terminal size={18} /> Full API Ref
                </Link>
                <Link
                  href="/developer/overview"
                  className="inline-flex items-center justify-center gap-2 rounded-[2.5rem] border border-white/10 bg-white/5 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:border-purple-500/40 hover:bg-white/10"
                >
                  <ShieldCheck size={18} /> Developer Hub
                </Link>
              </div>
            </div>

            {/* Right Column: Code Snippets */}
            <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-zinc-900/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_40%)]" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3 text-purple-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-purple-500/10">
                    <Code2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">
                      Endpoint Reference
                    </p>
                    <p className="text-sm font-black uppercase tracking-[0.1em] text-white">
                      POST /api/v1/sessions
                    </p>
                  </div>
                </div>

                {/* Node.js Request Snippet */}
                <div className="rounded-[2rem] border border-white/10 bg-black/60 p-5 overflow-x-auto">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">
                      1. The Request Example (Node.js)
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
                      <CheckCircle2 size={14} className="text-green-400" />
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
                  <pre className="text-[11px] font-mono leading-relaxed text-green-400/90">
                    <code>{RESPONSE_SNIPPET}</code>
                  </pre>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
