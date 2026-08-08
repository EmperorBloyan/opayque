'use client';

import React, { useState } from 'react';
import { Terminal, Shield, Play, ArrowLeft, Settings2 } from 'lucide-react';
import OpayqueCheckout from '@/components/OpayqueCheckout';

export default function DeveloperSandbox() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderId, setOrderId] = useState(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState(15.00);
  const [apiKey, setApiKey] = useState('osk_live_9f87d6abcdef88219903');
  const [merchantWallet, setMerchantWallet] = useState('7xKXtg2b...3b9Y');

  return (
    <main className="min-h-screen bg-[#050508] text-[#00ffcc] font-mono p-4 md:p-8 selection:bg-[#00ffcc] selection:text-black">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-[#1f293d] pb-5 mb-10 max-w-3xl mx-auto">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-[#ffb86c]/10 rounded-lg border border-[#ffb86c]/20">
            <Terminal className="w-5 h-5 text-[#ffb86c]" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-widest text-white uppercase">
              Opayque <span className="text-[#ffb86c] opacity-80">// Sandbox</span>
            </h1>
            <p className="text-[10px] text-gray-500 hidden md:block mt-1">TESTING ENVIRONMENT • ISOLATED RUNTIME</p>
          </div>
        </div>
        
        <a 
          href="/developer"
          className="flex items-center space-x-2 px-4 py-2 text-xs bg-[#0a0d14] border border-[#1f293d] text-gray-400 rounded-md hover:text-[#00ffcc] hover:border-[#00ffcc] transition-all shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>RETURN_TO_HUB</span>
        </a>
      </header>

      {/* Sandbox Controller Card */}
      <div className="max-w-3xl mx-auto bg-[#0a0d14] border border-[#1f293d] rounded-xl p-8 shadow-2xl relative overflow-hidden fade-in">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#ffb86c] to-transparent opacity-50"></div>
        
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#1f293d]/50">
          <Settings2 className="w-5 h-5 text-gray-400" />
          <h2 className="text-xs font-bold text-white tracking-widest uppercase">Simulation_Parameters</h2>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed mb-8">
          Configure your mock transaction payload below. This harness tests your integration with the atomic fee-splitting compiler before deploying to mainnet production.
        </p>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest">&gt; MOCK_ORDER_ID:</label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ffb86c] focus:ring-1 focus:ring-[#ffb86c]/20 transition-all font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest">&gt; AMOUNT_USDC:</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-[#00ffcc] focus:outline-none focus:border-[#ffb86c] focus:ring-1 focus:ring-[#ffb86c]/20 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest">&gt; ENVIRONMENT_API_KEY:</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-gray-400 focus:outline-none focus:border-[#ffb86c] focus:ring-1 focus:ring-[#ffb86c]/20 transition-all font-mono"
            />
          </div>
          
          <div className="pt-4">
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full flex items-center justify-center space-x-2 bg-[#ffb86c] text-black font-bold py-3.5 rounded-md hover:bg-[#e6a561] transition-all text-xs tracking-widest shadow-[0_0_15px_rgba(255,184,108,0.2)]"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>LAUNCH_EMBEDDED_CHECKOUT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Checkout Render */}
      {isCheckoutOpen && (
        <OpayqueCheckout
          apiKey={apiKey}
          orderId={orderId}
          amountUsdc={amount}
          merchantWallet={merchantWallet}
          onSuccess={(hash) => {
            console.log('[SANDBOX] Success. Hash:', hash);
          }}
          onClose={() => setIsCheckoutOpen(false)}
        />
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </main>
  );
}
