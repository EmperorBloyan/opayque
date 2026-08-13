"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Code2, 
  Key, 
  ShieldCheck, 
  Zap, 
  Terminal,
  Globe
} from "lucide-react";

interface Endpoint {
  id: string;
  method: "POST" | "GET" | "DELETE" | "PUT";
  path: string;
  title: string;
  description: string;
  headers: Record<string, string>;
  body?: string;
  responses: {
    status: number;
    title: string;
    json: string;
  }[];
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "create-session",
    method: "POST",
    path: "/api/v1/sessions",
    title: "Create Payment Session",
    description: "Generate a new cryptographic payment intent for checkout rendering.",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer osk_live_9f87d6abcdef...",
    },
    body: JSON.stringify(
      {
        order_id: "ORD-8821",
        amount_fiat: 15.00,
        currency: "USD",
        customer_email: "buyer@example.com",
      },
      null,
      2
    ),
    responses: [
      {
        status: 200,
        title: "200 OK",
        json: JSON.stringify(
          {
            success: true,
            payment_intent_id: "pi_9598201a",
            merchant_wallet: "7xKXtg...3b9Y",
            amount_crypto: "0.075",
            token: "USDC",
            fee_split: {
              merchant_share: "99.5%",
              opayque_share: "0.5%",
            },
          },
          null,
          2
        ),
      },
      {
        status: 401,
        title: "401 Unauthorized",
        json: JSON.stringify({ error: "Invalid or missing secret API key." }, null, 2),
      },
    ],
  },
  {
    id: "get-merchant",
    method: "GET",
    path: "/api/v1/merchant",
    title: "Fetch Merchant Profile",
    description: "Retrieve public and operational profile details for the authenticated merchant.",
    headers: {
      "Authorization": "Bearer osk_live_9f87d6abcdef...",
    },
    responses: [
      {
        status: 200,
        title: "200 OK",
        json: JSON.stringify(
          {
            merchant_name: "Opayque Corp",
            merchant_logo: "https://opayque.com/logo.png",
            settlement_wallet: "0x71C...392A",
            environment: "production",
          },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "list-keys",
    method: "GET",
    path: "/api/v1/keys",
    title: "List API Keys",
    description: "Retrieve active publishable and secret keys assigned to your workspace.",
    headers: {
      "Authorization": "Bearer osk_live_9f87d6abcdef...",
    },
    responses: [
      {
        status: 200,
        title: "200 OK",
        json: JSON.stringify(
          {
            keys: [
              { type: "publishable", key: "opk_live_3810a9..." },
              { type: "secret", key: "osk_live_9f87d6..." },
            ],
          },
          null,
          2
        ),
      },
    ],
  },
];

export default function ApiDocsPage() {
  const [activeEndpointId, setActiveEndpointId] = useState(ENDPOINTS[0].id);
  const [copiedCode, setCopiedCode] = useState(false);

  const currentEndpoint = ENDPOINTS.find((e) => e.id === activeEndpointId) || ENDPOINTS[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "POST":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "GET":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "DELETE":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-10 font-sans">
      <div className="mx-auto max-w-6xl">
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/quickstart"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                  Opayque Protocol API v1
                </span>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
                Full API Reference
              </h1>
            </div>
          </div>

          <Link
            href="/developer/overview"
            className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-purple-500/40 hover:text-white transition-all"
          >
            <Terminal size={14} /> Developer Hub
          </Link>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 px-2">
              Endpoints
            </p>
            {ENDPOINTS.map((endpoint) => (
              <button
                key={endpoint.id}
                onClick={() => setActiveEndpointId(endpoint.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                  activeEndpointId === endpoint.id
                    ? "bg-zinc-900/90 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    : "bg-black/40 border-white/5 hover:border-white/10 text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${getMethodBadgeClass(endpoint.method)}`}>
                    {endpoint.method}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    {endpoint.path}
                  </span>
                </div>
                <span className="text-xs font-semibold text-zinc-300">
                  {endpoint.title}
                </span>
              </button>
            ))}
          </div>

          {/* Main API Documentation View */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#0a0a0c] p-6 md:p-8 space-y-6">
              
              {/* Endpoint Meta Header */}
              <div className="space-y-3 border-b border-white/10 pb-6">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${getMethodBadgeClass(currentEndpoint.method)}`}>
                    {currentEndpoint.method}
                  </span>
                  <code className="text-base font-mono text-purple-300 font-semibold">
                    {currentEndpoint.path}
                  </code>
                </div>
                <h2 className="text-xl font-bold text-white">{currentEndpoint.title}</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {currentEndpoint.description}
                </p>
              </div>

              {/* Request Headers */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                  HTTP Headers
                </p>
                <div className="rounded-2xl border border-white/5 bg-black/60 p-4 font-mono text-xs space-y-1.5">
                  {Object.entries(currentEndpoint.headers).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-purple-400">{key}:</span>
                      <span className="text-zinc-300">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Body Payload if available */}
              {currentEndpoint.body && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Request Payload (JSON)
                    </p>
                    <button
                      onClick={() => handleCopy(currentEndpoint.body || "")}
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <pre className="rounded-2xl border border-white/5 bg-black/80 p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
                    <code>{currentEndpoint.body}</code>
                  </pre>
                </div>
              )}

              {/* Response Blocks */}
              <div className="space-y-3 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                  Expected Responses
                </p>
                {currentEndpoint.responses.map((res, i) => (
                  <div key={i} className="rounded-2xl border border-white/5 bg-black/80 overflow-hidden">
                    <div className="bg-zinc-900/80 px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-emerald-400">{res.title}</span>
                    </div>
                    <pre className="p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
                      <code>{res.json}</code>
                    </pre>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
