"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { 
  LucideLayoutDashboard, 
  LucideSettings2, 
  LucideCamera, 
  LucideShieldCheck, 
  LucideShieldAlert 
} from "lucide-react";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  
  const [merchantName, setMerchantName] = useState("Opayque");
  const [logo, setLogo] = useState<string | null>(null);

  // Load Merchant Settings
  useEffect(() => {
    const savedLogo = localStorage.getItem("merchant_logo");
    const savedName = localStorage.getItem("merchant_name");
    if (savedLogo) setLogo(savedLogo);
    if (savedName) setMerchantName(savedName);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setLogo(base64);
        localStorage.setItem("merchant_logo", base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.trim() || "Opayque";
    setMerchantName(newName);
    localStorage.setItem("merchant_name", newName);
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

  return (
    <div className="min-h-screen bg-black text-white p-6 selection:bg-purple-500/30">
      <div id="vault-glow" className="fixed inset-0 bg-purple-500/5 pointer-events-none transition-all duration-500"></div>

      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/5 pb-8 gap-6">
          <div className="flex items-center gap-5">
            {/* MERCHANT LOGO */}
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-purple-500/20 flex items-center justify-center overflow-hidden hover:border-purple-500 transition-all shadow-inner">
                {logo ? (
                  <img src={logo} alt="Merchant Brand Logo" className="w-full h-full object-cover" />
                ) : (
                  <LucideCamera size={20} className="text-zinc-600 group-hover:text-purple-400" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleLogoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer" 
                aria-label="Upload merchant logo"
              />
            </div>
            
            <div>
              {/* Editable Merchant Name - Fix 6 */}
              <input 
                value={merchantName}
                onChange={handleNameChange}
                className="bg-transparent border-none p-0 text-3xl font-black italic tracking-tighter uppercase leading-none focus:ring-0 w-full outline-none hover:text-purple-400 transition-colors"
                placeholder="Merchant Name"
                aria-label="Edit merchant name"
              />
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
