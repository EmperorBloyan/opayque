"use client";

import React, { useState } from "react";
import { 
  LucideKey, 
  LucideShield, 
  LucideEye, 
  LucideEyeOff, 
  LucideRefreshCw, 
  LucideCopy, 
  LucideCheck,
  LucideGlobe,
  LucidePlus,
  LucideTrash2,
  LucideAlertTriangle
} from "lucide-react";

interface ApiKey {
  id: string;
  environment: "Mainnet" | "Testnet";
  prefix: string;
  secret: string;
  lastUsed: string;
  createdAt: string;
}

const INITIAL_KEYS: ApiKey[] = [
  {
    id: "key_prod_1",
    environment: "Mainnet",
    prefix: "opq_live_",
    secret: "9x8f7d6e5c4b3a210_encrypted_hash",
    lastUsed: "2 mins ago",
    createdAt: "2026-01-15"
  },
  {
    id: "key_test_1",
    environment: "Testnet",
    prefix: "opq_test_",
    secret: "1a2b3c4d5e6f7g8h9_mock_hash",
    lastUsed: "14 hours ago",
    createdAt: "2026-03-22"
  }
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(INITIAL_KEYS);
  const [visibleKeyId, setVisibleKeyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Security Settings State
  const [ipWhitelist, setIpWhitelist] = useState<string[]>(["192.168.1.1", "203.0.113.50"]);
  const [newIp, setNewIp] = useState("");
  const [requireTee, setRequireTee] = useState(true);
  
  // Modal State
  const [showRollModal, setShowRollModal] = useState<string | null>(null);

  const toggleVisibility = (id: string) => {
    setVisibleKeyId(visibleKeyId === id ? null : id);
  };

  const handleCopy = (id: string, secret: string, prefix: string) => {
    navigator.clipboard.writeText(`${prefix}${secret}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (newIp && !ipWhitelist.includes(newIp)) {
      setIpWhitelist([...ipWhitelist, newIp]);
      setNewIp("");
    }
  };

  const handleRemoveIp = (ipToRemove: string) => {
    setIpWhitelist(ipWhitelist.filter(ip => ip !== ipToRemove));
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Ambient Visuals */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
        
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <LucideKey size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Authentication Center</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white">
            API Keys & Security
          </h1>
          <p className="text-zinc-500 text-xs mt-3 uppercase tracking-widest font-bold">
            Manage programmatic access credentials and enclave enforcement rules.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: API Keys (Takes up 2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <LucideShield size={14} className="text-purple-400" /> Active Credentials
              </span>
              <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors">
                <LucidePlus size={14} /> Generate New Key
              </button>
            </div>

            <div className="space-y-4">
              {keys.map((key) => (
                <div 
                  key={key.id}
                  className="p-8 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md relative overflow-hidden group hover:border-white/10 transition-all"
                >
                  {/* Environment Badge */}
                  <div className="absolute top-6 right-8">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      key.environment === "Mainnet" 
                        ? "bg-purple-600/10 border-purple-500/30 text-purple-400" 
                        : "bg-zinc-800/50 border-zinc-600/30 text-zinc-400"
                    }`}>
                      {key.environment}
                    </span>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-1">
                      Standard Token
                    </h3>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest">
                      Created {key.createdAt} • Last used {key.lastUsed}
                    </p>
                  </div>

                  {/* Secret Display Block */}
                  <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-zinc-500 font-mono text-xs">{key.prefix}</span>
                      <code className="text-zinc-300 font-mono text-sm tracking-wider truncate">
                        {visibleKeyId === key.id ? key.secret : "••••••••••••••••••••••••••••"}
                      </code>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button 
                        onClick={() => toggleVisibility(key.id)}
                        className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-lg"
                      >
                        {visibleKeyId === key.id ? <LucideEyeOff size={14} /> : <LucideEye size={14} />}
                      </button>
                      <button 
                        onClick={() => handleCopy(key.id, key.secret, key.prefix)}
                        className="p-2 text-purple-400 hover:text-purple-300 transition-colors bg-purple-500/10 rounded-lg"
                      >
                        {copiedId === key.id ? <LucideCheck size={14} /> : <LucideCopy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-end border-t border-white/5 pt-4">
                    <button 
                      onClick={() => setShowRollModal(key.id)}
                      className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-500/80 hover:text-amber-400 transition-colors"
                    >
                      <LucideRefreshCw size={12} /> Roll API Key
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Security Rules */}
          <div className="space-y-6">
            
            {/* TEE Enforcement */}
            <div className="p-8 rounded-[3rem] bg-purple-900/10 border border-purple-500/20 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-1">
                    Enclave Enforcement
                  </h3>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Require cryptographic attestation from TEE environments for all API requests.
                  </p>
                </div>
                {/* Custom Toggle */}
                <button 
                  onClick={() => setRequireTee(!requireTee)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    requireTee ? 'bg-purple-600' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    requireTee ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* IP Whitelist */}
            <div className="p-8 rounded-[3rem] bg-zinc-900/80 border border-white/5 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <LucideGlobe size={16} className="text-purple-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-white">IP Whitelist</h3>
              </div>

              <form onSubmit={handleAddIp} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g., 198.51.100.1"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                />
                <button 
                  type="submit"
                  className="px-4 bg-purple-600 text-white rounded-2xl hover:bg-purple-500 transition-colors"
                >
                  <LucidePlus size={16} />
                </button>
              </form>

              <div className="space-y-2">
                {ipWhitelist.map((ip) => (
                  <div key={ip} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-2xl group">
                    <code className="text-xs font-mono text-zinc-300">{ip}</code>
                    <button 
                      onClick={() => handleRemoveIp(ip)}
                      className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <LucideTrash2 size={14} />
                    </button>
                  </div>
                ))}
                {ipWhitelist.length === 0 && (
                  <p className="text-[10px] text-zinc-500 italic">No IP addresses restricted. Open access.</p>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Roll Key Confirmation Modal */}
      {showRollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-red-500/20 p-8 rounded-[3rem] max-w-md w-full space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />
            
            <div className="flex items-center gap-3 text-amber-500">
              <LucideAlertTriangle size={24} />
              <h3 className="text-lg font-black italic uppercase tracking-tight">
                Roll API Key?
              </h3>
            </div>
            
            <p className="text-[11px] text-zinc-400 leading-relaxed uppercase tracking-widest font-bold">
              Rolling this key will instantly invalidate the current secret. Any active integration using the old key will fail immediately. 
            </p>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setShowRollModal(null)}
                className="w-1/2 py-3 bg-black/40 border border-white/10 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowRollModal(null)} // Hook up actual roll logic here later
                className="w-1/2 py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20"
              >
                Confirm Roll
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
