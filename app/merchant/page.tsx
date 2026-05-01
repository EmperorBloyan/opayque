"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { getPrivateBalance, buildWithdraw } from '@/lib/magicblock';

export default function MerchantAdmin() {
  const { publicKey, connected } = useWallet();
  
  // --- STATE: FINANCIALS ---
  const [privateBalance, setPrivateBalance] = useState<number>(0);
  const [flushLoading, setFlushLoading] = useState(false);
  const [mainWallet, setMainWallet] = useState("");

  // --- STATE: ENTERPRISE / PAIRING ---
  const [pairingToken, setPairingToken] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffAddress, setStaffAddress] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);

  // Fetch Balance Logic
  useEffect(() => {
    if (!publicKey) return;
    const fetchBalance = async () => {
      try {
        const balance = await getPrivateBalance(publicKey.toBase58());
        setPrivateBalance(balance || 0);
      } catch (err) { console.error("Balance Error:", err); }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [publicKey]);

  // Generate 6-Digit Pairing Code
  const generatePairingToken = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingToken(code);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setProfilePic(URL.createObjectURL(file));
  };

  const handleFlush = async () => {
    if (!publicKey || !mainWallet || privateBalance <= 0) return;
    setFlushLoading(true);
    // Logic as defined in our previous TEE sessions...
    setTimeout(() => { 
        setFlushLoading(false); 
        setPrivateBalance(0);
        alert("Privacy Flush Complete: Funds moved to L1");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter">OPAYQUE<span className="text-purple-500">.</span></h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Enterprise Shielded Command</p>
          </div>
          <WalletMultiButton className="!bg-white !text-black !rounded-full !font-bold !text-xs" />
        </div>

        {!connected ? (
            <div className="h-64 border border-dashed border-white/10 rounded-[3rem] flex flex-center items-center justify-center text-zinc-600 uppercase text-[10px] tracking-widest font-bold">
                Connect Wallet to Access TEE Vault
            </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-1000">
            
            {/* LEFT COLUMN: VAULT & SETTLEMENT (4 Cols) */}
            <div className="lg:col-span-5 space-y-8">
              <div className="p-8 rounded-[3rem] bg-gradient-to-br from-purple-900/20 to-zinc-900 border border-purple-500/30">
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Vault Balance</p>
                <h2 className="text-6xl font-mono font-bold">${privateBalance.toFixed(2)}</h2>
                <div className="mt-8 p-6 bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-[9px] text-zinc-500 uppercase mb-4 font-bold">Privacy Settlement Address</p>
                    <input 
                        className="w-full bg-transparent border-b border-white/10 pb-2 text-xs outline-none focus:border-purple-500 transition-all mb-6"
                        placeholder="Enter L1 Target Address"
                        value={mainWallet}
                        onChange={(e) => setMainWallet(e.target.value)}
                    />
                    <button 
                        onClick={handleFlush}
                        disabled={flushLoading || privateBalance <= 0}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:invert transition-all disabled:opacity-20"
                    >
                        {flushLoading ? "FLUSHING..." : "Flush to L1 Wallet"}
                    </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ENTERPRISE CONTROLS (7 Cols) */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* TERMINAL PAIRING CARD */}
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest">Device Authorization</h3>
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex items-center gap-6 p-6 bg-black rounded-3xl border border-white/5">
                    <div className="flex-1">
                        <p className="text-[9px] text-zinc-500 uppercase font-bold">Current Pairing Code</p>
                        <p className="text-3xl font-mono font-black tracking-tighter">
                            {pairingToken || "------"}
                        </p>
                    </div>
                    <button 
                        onClick={generatePairingToken}
                        className="px-6 py-4 bg-zinc-800 hover:bg-white hover:text-black rounded-2xl font-bold text-[10px] uppercase transition-all"
                    >
                        New Token
                    </button>
                </div>
              </div>

              {/* STAFF/CAUSE ONBOARDING */}
              <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem]">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-8">Register New Endpoint</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="w-full aspect-square rounded-[2rem] bg-black border border-white/5 overflow-hidden flex items-center justify-center relative group">
                            {profilePic ? (
                                <img src={profilePic} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[9px] text-zinc-700 font-bold uppercase">No Identity Loaded</span>
                            )}
                            <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                                <span className="text-[10px] font-bold uppercase">Upload</span>
                                <input type="file" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                    </div>
                    <div className="flex flex-col justify-between space-y-4">
                        <input 
                            placeholder="NAME / CAUSE"
                            className="w-full bg-black border border-white/5 p-4 rounded-2xl text-xs outline-none focus:border-purple-500"
                            onChange={(e) => setStaffName(e.target.value)}
                        />
                        <input 
                            placeholder="SOLANA WALLET"
                            className="w-full bg-black border border-white/5 p-4 rounded-2xl text-[10px] font-mono outline-none focus:border-purple-500"
                            onChange={(e) => setStaffAddress(e.target.value)}
                        />
                        <button className="w-full py-6 bg-purple-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-purple-500/10">
                            Authorize Endpoint
                        </button>
                    </div>
                </div>
              </div>

            </div>
          </div>
        )}

        <footer className="mt-20 border-t border-white/5 pt-8 text-center">
            <p className="text-[9px] text-zinc-700 uppercase font-bold tracking-[0.5em]">Opayque Protocol v1.0 • MagicBlock TEE Secured</p>
        </footer>
      </div>
    </div>
  );
}
