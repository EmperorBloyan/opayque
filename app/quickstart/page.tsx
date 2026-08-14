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
  },
  "payment_url": "https://opayque-three.vercel.app/pay/pi_9938201a",
  "expires_at": "2026-08-14T15:00:00Z",
  "network": "Solana"
}`;

export default function OpayqueApiDocs() {
  const router = useRouter();
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  const handleCopy = (text: string, type: 'req' | 'res') => {
    navigator.clipboard.writeText(text);
    if (type === 'req') {
      setCopiedReq(true);
      setTimeout(() => setCopiedReq(false), 2000);
    } else {
      setCopiedRes(true);
      setTimeout(() => setCopiedRes(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12 font-sans selection:bg-blue-500/30">
      <button 
        onClick={() => router.back()} 
        className="flex items-center text-zinc-400 hover:text-white transition-colors mb-10 group"
      >
        <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Dashboard
      </button>

      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Section */}
        <header className="space-y-5">
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-300">
            <Terminal className="w-4 h-4 mr-2 text-blue-400" />
            API Reference v1
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Integrate Opayque Payments
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Create seamless USDC checkout sessions. Our API handles fiat-to-crypto conversion, automated fee routing, and on-chain verification instantly.
          </p>
        </header>

        {/* Interactive Code Section */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Request Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center text-zinc-200">
                <Code2 className="w-5 h-5 mr-2 text-zinc-500" />
                Create Session
              </h3>
              <button 
                onClick={() => handleCopy(REQUEST_SNIPPET, 'req')}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copiedReq ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-5 overflow-x-auto shadow-2xl relative group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <pre className="text-sm text-zinc-300 font-mono leading-relaxed">
                <code>{REQUEST_SNIPPET}</code>
              </pre>
            </div>
          </div>

          {/* Response Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center text-zinc-200">
                <CheckCircle2 className="w-5 h-5 mr-2 text-zinc-500" />
                Success Response
              </h3>
              <button 
                onClick={() => handleCopy(RESPONSE_SNIPPET, 'res')}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all active:scale-95"
                title="Copy to clipboard"
              >
                {copiedRes ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="bg-[#0c0c0e] border border-zinc-800/80 rounded-xl p-5 overflow-x-auto shadow-2xl relative group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <pre className="text-sm text-blue-300 font-mono leading-relaxed">
                <code>{RESPONSE_SNIPPET}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 pt-10 border-t border-zinc-800/50 mt-12">
          <div className="space-y-3 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800/50">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="font-semibold text-zinc-200">Instant Settlement</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Funds are routed directly to your Solana wallet with zero intermediary holding periods.
            </p>
          </div>
          
          <div className="space-y-3 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800/50">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <h4 className="font-semibold text-zinc-200">Secure Validation</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">
              On-chain transaction verification ensures payments are finalized before webhooks ever fire.
            </p>
          </div>

          <div className="space-y-3 p-4 rounded-2xl hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="font-semibold text-zinc-200">0.5% Flat Fee</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Simple, transparent pricing. The revenue split is executed automatically within the contract.
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <div className="pt-8 flex justify-center">
          <Link 
            href="https://opayque-three.vercel.app/docs" 
            target="_blank"
            className="inline-flex items-center text-sm text-zinc-400 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Full Technical Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
