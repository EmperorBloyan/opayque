"use client";

import React, { useState } from "react";
import { 
  LucideCode, 
  LucideKey, 
  LucideTerminal, 
  LucideBookOpen, 
  LucideCopy,
  LucideCheckCircle
} from "lucide-react";
import OpayqueCheckout from "@/components/OpayqueCheckout";

export default function DeveloperHub() {
  const [showSandbox, setShowSandbox] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const mockApiKey = "opq_live_9x8f7d6e5c4b3a210";

  const handleCopy = () => {
    navigator.clipboard.writeText(mockApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Ambient Vault-style Visuals */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header Section */}
        <header className="mb-12">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <LucideCode size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Developer Integration</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white">
            API & Protocol Hub
          </h1>
          <p className="text-zinc-500 text-xs mt-3 uppercase tracking-widest font-bold">
            Manage Opayque endpoints, RPC routing, and checkout sandboxes.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: API Keys & Docs */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* API Key Vault */}
            <div className="p-10 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-black/40 rounded-2xl flex items-center justify-center border border-white/5 text-purple-500">
                  <LucideKey size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">Production API Key</h3>
                  <p className="text-[10px] text-zinc-500 tracking-widest uppercase mt-1">Bearer Token Authentication</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-2xl p-4">
                <code className="text-zinc-300 font-mono text-sm tracking-wider">{mockApiKey}</code>
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {copied ? <LucideCheckCircle size={14} /> : <LucideCopy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Protocol Documentation Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button className="flex flex-col items-start p-8 bg-black/40 border border-white/5 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left">
                <LucideBookOpen size={20} className="text-zinc-500 mb-4" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white mb-2">Solana RPC Config</h4>
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Setup multi-provider RPC layer abstractions for resilient network settlement.
                </p>
              </button>
              
              <button className="flex flex-col items-start p-8 bg-black/40 border border-white/5 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left">
                <LucideTerminal size={20} className="text-zinc-500 mb-4" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white mb-2">Mobile Wallet Adapter</h4>
                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Deep-linking configurations and hardware terminal pairing payloads.
                </p>
              </button>
            </div>
          </div>

          {/* Right Column: Checkout Sandbox Area */}
          <div className="space-y-6">
            <div className="p-8 rounded-[3rem] bg-purple-900/10 border border-purple-500/20 relative overflow-hidden flex flex-col h-full">
              <div className="mb-auto">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-2">
                  Sandbox Environment
                </h3>
                <p className="text-[10px] text-zinc-400 leading-relaxed mb-8">
                  Simulate the shielded checkout flow before pushing to mainnet. This utilizes your current testnet configurations.
                </p>
              </div>

              <button
                onClick={() => setShowSandbox(true)}
                className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
              >
                Launch Checkout Simulation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render the Checkout Simulation Modal */}
      {showSandbox && (
        <OpayqueCheckout 
          apiKey={mockApiKey}
          orderId={`TEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`}
          amountUsdc={150.00}
          merchantWallet="MerchantDummyWalletAddressHere"
          onClose={() => setShowSandbox(false)}
          onSuccess={(hash) => {
            console.log("Sandbox tx successful:", hash);
            setTimeout(() => setShowSandbox(false), 3000);
          }}
        />
      )}
    </main>
  );
}
