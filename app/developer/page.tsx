'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Shield, Key, BarChart3, FileText, ArrowRight, CheckCircle2, Copy, Check, Activity, RefreshCw } from 'lucide-react';

export default function DeveloperHub() {
  const [step, setStep] = useState<'terminal' | 'security' | 'dashboard'>('terminal');
  const [walletAddress, setWalletAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'webhooks'>('overview');
  
  // Modals & UI States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (walletAddress.trim()) {
      setIsInitializing(true);
      setTimeout(() => {
        setIsInitializing(false);
        setStep('security');
      }, 800);
    }
  };

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) setStep('dashboard');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#050508] text-[#00ffcc] font-mono p-4 md:p-8 selection:bg-[#00ffcc] selection:text-black">
      {/* Dynamic Header */}
      <header className="flex justify-between items-center border-b border-[#1f293d] pb-5 mb-10 max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-[#00ffcc]/10 rounded-lg border border-[#00ffcc]/20">
            <Terminal className="w-5 h-5 text-[#00ffcc]" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-widest text-white uppercase">
              Opayque <span className="text-[#00ffcc] opacity-80">// Dev_Hub</span>
            </h1>
            <p className="text-[10px] text-gray-500 hidden md:block mt-1">v2.0.0-rc.1 — LIVE ENVIRONMENT</p>
          </div>
        </div>
        
        {step === 'dashboard' && (
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="group flex items-center space-x-2 px-4 py-2 text-xs bg-[#0a0d14] border border-[#1f293d] text-[#00ffcc] rounded-md hover:border-[#00ffcc] hover:bg-[#00ffcc]/5 transition-all shadow-sm"
            >
              <Key className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
              <span>API_KEYS</span>
            </button>
            <button 
              onClick={() => setShowDocsModal(true)}
              className="flex items-center space-x-2 px-4 py-2 text-xs bg-[#0a0d14] border border-[#1f293d] text-[#ffb86c] rounded-md hover:border-[#ffb86c] hover:bg-[#ffb86c]/5 transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>QUICKSTART</span>
            </button>
          </div>
        )}
      </header>

      {/* STEP 1: Terminal-Style Initialization */}
      {step === 'terminal' && (
        <div className="max-w-2xl mx-auto mt-20 bg-[#0a0d14] border border-[#1f293d] rounded-xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00ffcc] to-transparent opacity-50"></div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-400 mb-8 pb-4 border-b border-[#1f293d]/50">
            <div className="flex space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></span>
            </div>
            <span className="ml-4 font-mono text-gray-500">~/opayque/init-node</span>
          </div>
          
          <form onSubmit={handleTerminalSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs text-gray-400">&gt; DEFINE_DESTINATION_WALLET_ADDRESS:</label>
              <input
                type="text"
                required
                placeholder="e.g., 7xKXtg...3b9Y (Solana)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc]/20 transition-all placeholder:text-gray-700 font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs text-gray-400">&gt; LINK_ADMIN_EMAIL (Optional):</label>
              <input
                type="email"
                placeholder="developer@protocol.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00ffcc] focus:ring-1 focus:ring-[#00ffcc]/20 transition-all placeholder:text-gray-700 font-mono"
              />
            </div>
            
            <button
              type="submit"
              disabled={isInitializing}
              className="w-full mt-4 flex items-center justify-center space-x-2 bg-[#00ffcc] text-black font-bold py-3.5 rounded-md hover:bg-[#00e6b8] transition-all text-xs tracking-widest disabled:opacity-70"
            >
              {isInitializing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>COMPILING_ENVIRONMENT...</span>
                </>
              ) : (
                <>
                  <span>MOUNT_DEVELOPER_NODE</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: Biometric / Master Passkey Gate */}
      {step === 'security' && (
        <div className="max-w-md mx-auto mt-24 bg-[#0a0d14] border border-[#1f293d] rounded-xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#ffb86c] to-transparent opacity-50"></div>
          
          <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
            <div className="p-4 bg-[#ffb86c]/10 rounded-full">
              <Shield className="w-8 h-8 text-[#ffb86c]" />
            </div>
            <div>
              <h2 className="text-white text-sm font-bold tracking-widest uppercase">Encryption_Gate</h2>
              <p className="text-[11px] text-gray-500 mt-2 max-w-xs">Secure your live environment. This acts as a fallback for biometric authentication.</p>
            </div>
          </div>

          <form onSubmit={handleSecuritySubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-gray-400 uppercase tracking-widest text-center">Master Passkey</label>
              <input
                type="password"
                required
                autoFocus
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-lg text-white focus:outline-none focus:border-[#ffb86c] focus:ring-1 focus:ring-[#ffb86c]/20 transition-all tracking-[0.5em]"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#ffb86c] text-black font-bold py-3.5 rounded-md hover:bg-[#e6a561] transition-all text-xs tracking-widest shadow-[0_0_15px_rgba(255,184,108,0.15)]"
            >
              AUTHORIZE_SESSION
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: Core Workspace (Overview & Logs) */}
      {step === 'dashboard' && (
        <div className="space-y-8 max-w-7xl mx-auto fade-in">
          {/* Sub-Navigation */}
          <div className="flex space-x-8 border-b border-[#1f293d] pb-0 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-2 pb-4 transition-colors relative ${
                activeTab === 'overview' ? 'text-[#00ffcc]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="tracking-widest">NETWORK_METRICS</span>
              {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00ffcc] shadow-[0_0_8px_rgba(0,255,204,0.6)]"></div>}
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`flex items-center space-x-2 pb-4 transition-colors relative ${
                activeTab === 'webhooks' ? 'text-[#00ffcc]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="tracking-widest">DELIVERY_REGISTRY</span>
              {activeTab === 'webhooks' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00ffcc] shadow-[0_0_8px_rgba(0,255,204,0.6)]"></div>}
            </button>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0a0d14] border border-[#1f293d] p-6 rounded-xl relative overflow-hidden group hover:border-[#2a3752] transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-16 h-16 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] text-gray-500 tracking-widest block mb-4">TOTAL_API_CALLS (24H)</span>
                <p className="text-4xl font-light text-white font-mono">1,482</p>
                <div className="mt-4 flex items-center space-x-2 text-[10px]">
                  <span className="text-[#00ffcc] bg-[#00ffcc]/10 px-1.5 py-0.5 rounded">↑ 14.2%</span>
                  <span className="text-gray-600">vs yesterday</span>
                </div>
              </div>

              <div className="bg-[#0a0d14] border border-[#1f293d] p-6 rounded-xl relative overflow-hidden group hover:border-[#2a3752] transition-colors">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <CheckCircle2 className="w-16 h-16 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] text-gray-500 tracking-widest block mb-4">SETTLEMENT_SUCCESS</span>
                <p className="text-4xl font-light text-[#00ffcc] font-mono">99.9<span className="text-2xl">%</span></p>
                <div className="mt-4 flex items-center space-x-2 text-[10px]">
                  <span className="text-gray-400">0 custody drops recorded</span>
                </div>
              </div>

              <div className="bg-[#0a0d14] border border-[#1f293d] p-6 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-gray-500 tracking-widest block mb-2">ROUTING_DESTINATION</span>
                <div className="bg-[#050508] border border-[#1f293d] p-3 rounded-md">
                  <p className="text-xs text-[#ffb86c] font-mono truncate">{walletAddress || '7xKXtg...3b9Y'}</p>
                </div>
                <span className="text-[10px] text-gray-600 mt-3 block">Atomic 99.5/0.5 split enforced</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#0a0d14] border border-[#1f293d] rounded-xl p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#1f293d]">
                <h3 className="text-xs font-bold text-gray-300 tracking-widest uppercase">Transmission_Logs</h3>
                <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span>LISTENING_ON_PORT_443</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Mock Log Entry */}
                <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#050508] border border-[#1f293d] rounded-lg hover:border-[#2a3752] transition-colors group">
                  <div className="flex items-center space-x-4 mb-3 md:mb-0">
                    <div className="p-1.5 bg-green-500/10 rounded">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <span className="text-xs text-white font-mono font-bold block mb-1">[200 OK] payment.settled</span>
                      <span className="text-[10px] text-gray-500 font-mono">req_id: 8821a99f • dest: /webhooks/opayque</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-600 text-[10px] font-mono">2m ago</span>
                    <button className="px-3 py-1.5 bg-[#0a0d14] border border-[#1f293d] text-gray-400 rounded-md hover:text-[#00ffcc] hover:border-[#00ffcc]/50 transition-all text-[10px] tracking-widest">
                      RESEND
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: API Keys & Settings */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-[#0a0d14] border border-[#1f293d] rounded-xl p-8 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">✕</button>
            
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#1f293d]">
              <Key className="w-5 h-5 text-[#00ffcc]" />
              <h3 className="text-sm font-bold text-white tracking-widest uppercase">Secret_Keys</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 tracking-widest uppercase">Production Key</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="password" 
                    readOnly 
                    value="osk_live_9f87d6abcdef88219903" 
                    className="w-full bg-[#050508] border border-[#1f293d] rounded-md px-4 py-3 text-sm text-[#00ffcc] font-mono focus:outline-none"
                  />
                  <button 
                    onClick={() => copyToClipboard('osk_live_9f87d6abcdef88219903')}
                    className="p-3 bg-[#050508] border border-[#1f293d] rounded-md hover:border-[#00ffcc] text-gray-400 hover:text-[#00ffcc] transition-colors"
                  >
                    {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-[#ffb86c] mt-2">Warning: Do not expose this key in client-side code.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Quickstart / Registry */}
      {showDocsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
          <div className="bg-[#0a0d14] border border-[#1f293d] rounded-xl p-8 max-w-2xl w-full shadow-2xl relative">
            <button onClick={() => setShowDocsModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">✕</button>
            
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#1f293d]">
              <FileText className="w-5 h-5 text-[#ffb86c]" />
              <h3 className="text-sm font-bold text-white tracking-widest uppercase">Integration_Registry</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">Initialize a secure session intent via your backend infrastructure to mount the checkout module.</p>
              
              <div className="bg-[#050508] border border-[#1f293d] rounded-lg overflow-hidden">
                <div className="flex items-center px-4 py-2 bg-[#0a0d14] border-b border-[#1f293d] text-[10px] text-gray-500 font-mono">
                  <span>POST /api/v1/sessions</span>
                </div>
                <div className="p-4 overflow-x-auto text-xs font-mono">
<pre className="text-[#00ffcc]"><span className="text-pink-500">const</span> response = <span className="text-blue-400">await</span> <span className="text-yellow-200">fetch</span>(<span className="text-green-400">'https://opayque.com/api/v1/sessions'</span>, {'{'}
  method: <span className="text-green-400">'POST'</span>,
  headers: {'{'}
    <span className="text-green-400">'Authorization'</span>: <span className="text-green-400">'Bearer osk_live_...'</span>,
    <span className="text-green-400">'Content-Type'</span>: <span className="text-green-400">'application/json'</span>
  {'}'},
  body: <span className="text-yellow-200">JSON</span>.<span className="text-blue-200">stringify</span>({'{'}
    order_id: <span className="text-green-400">"ORD-8821"</span>,
    amount_fiat: <span className="text-orange-400">15.00</span>
  {'}'})
{'}'});</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Global styles for fade-in animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </main>
  );
}
