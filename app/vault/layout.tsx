"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  LucideLayoutDashboard, 
  LucideSettings2, 
  LucideCamera, 
  LucideShieldCheck, 
  LucideShieldAlert,
  LucidePencilLine
} from "lucide-react";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  const isStandaloneCheckout = pathname === '/vault/checkout';
  
  const [merchantName, setMerchantName] = useState("Opayque");
  const [logo, setLogo] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState("Opayque");
  const [draftLogo, setDraftLogo] = useState<string | null>(null);

  // Load Merchant Settings
  useEffect(() => {
    const savedLogo = localStorage.getItem("merchant_logo");
    const savedName = localStorage.getItem("merchant_name");
    if (savedLogo) {
      setLogo(savedLogo);
      setDraftLogo(savedLogo);
    }
    if (savedName) {
      setMerchantName(savedName);
      setDraftName(savedName);
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setDraftLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    const nextName = draftName.trim() || "Opayque";
    const nextLogo = draftLogo ?? logo;
    setMerchantName(nextName);
    setLogo(nextLogo);
    localStorage.setItem("merchant_name", nextName);
    if (nextLogo) {
      localStorage.setItem("merchant_logo", nextLogo);
    }
    setIsEditingProfile(false);
  };

  // Fix 10: Exact 1200ms entrance with tuned glow
  const handleVaultEntrance = () => {
    const glow = document.getElementById('vault-glow');
    if (glow) {
      glow.classList.add('animate-pulse');
      setTimeout(() => {
        glow.classList.remove('animate-pulse');
      }, 1200); // Exactly as requested
    }
  };

  // Trigger entrance animation on load
  useEffect(() => {
    handleVaultEntrance();
  }, []);

  const addressContent = publicKey 
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` 
    : "Not Connected";

  if (isStandaloneCheckout) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 selection:bg-purple-500/30">
      <div id="vault-glow" className="fixed inset-0 bg-purple-500/5 pointer-events-none transition-all duration-500"></div>

      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/5 pb-8 gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-purple-500/20 flex items-center justify-center overflow-hidden transition-all shadow-inner">
                {logo ? (
                  <img src={logo} alt="Merchant Brand Logo" className="w-full h-full object-cover" />
                ) : (
                  <LucideCamera size={20} className="text-zinc-600" />
                )}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-white">{merchantName}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(merchantName);
                    setDraftLogo(logo);
                    setIsEditingProfile(true);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 hover:shadow-[0_0_18px_rgba(168,85,247,0.35)]"
                  aria-label="Edit merchant profile"
                >
                  <LucidePencilLine size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {connected ? (
                  <LucideShieldCheck size={12} className="text-green-500" />
                ) : (
                  <LucideShieldAlert size={12} className="text-zinc-600" />
                )}
                <p className="text-zinc-500 text-[9px] uppercase tracking-[0.2em] font-bold">
                  Vault ID: <span className="font-mono text-zinc-400">{addressContent}</span>
                </p>
              </div>
            </div>
          </div>

          {/* NAV */}
          <nav className="flex bg-zinc-900/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            <Link 
              href="/vault/dashboard" 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                pathname.startsWith('/vault/dashboard') 
                  ? 'bg-white text-black shadow-xl shadow-white/5' 
                  : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <LucideLayoutDashboard size={14} /> Dashboard
            </Link>
            <Link 
              href="/vault/registry" 
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                pathname.startsWith('/vault/registry') 
                  ? 'bg-white text-black shadow-xl shadow-white/5' 
                  : 'text-zinc-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <LucideSettings2 size={14} /> Registry
            </Link>
          </nav>
        </header>

        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 py-8 md:items-center md:py-0">
            <div className="w-full max-w-xl rounded-[2.5rem] border border-white/10 bg-zinc-950/95 p-8 shadow-[0_0_25px_rgba(168,85,247,0.45)] ring-1 ring-white/10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Edit Merchant Profile</p>
                  <h2 className="text-3xl font-black tracking-tight text-white">Profile settings</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <label className="text-sm uppercase tracking-[0.35em] text-zinc-500">Avatar</label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full border border-white/10 bg-gradient-to-br from-violet-700 to-fuchsia-500 shadow-[0_0_18px_rgba(168,85,247,0.35)] overflow-hidden flex items-center justify-center text-2xl font-black text-white">
                      {draftLogo ? (
                        <img src={draftLogo} alt="Avatar preview" className="h-full w-full object-cover" />
                      ) : (
                        <LucideCamera size={18} />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-violet-500"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <label className="text-sm uppercase tracking-[0.35em] text-zinc-500">Merchant name</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-[1.8rem] border border-white/10 bg-zinc-900/70 px-5 py-4 text-lg font-bold text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="inline-flex w-full justify-center rounded-[1.8rem] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] transition hover:shadow-[0_0_28px_rgba(168,85,247,0.55)] hover:brightness-110"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="relative">
          {children}
        </main>

        <footer className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center opacity-30">
          <p className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
            Powered by Solana TEE Infrastructure
          </p>
          <div className="flex gap-4">
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${connected ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${connected ? 'bg-purple-500' : 'bg-zinc-700'}`} />
          </div>
        </footer>
      </div>
    </div>
  );
}
