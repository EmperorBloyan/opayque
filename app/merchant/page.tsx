"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';

// IMPROVEMENT: Proper USDC Formatter
const formatUSDC = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function MerchantAdmin() {
  const { publicKey, connected } = useWallet();
  
  const [privateBalance, setPrivateBalance] = useState<number>(1250.50); // Mock starting balance for demo
  const [flushLoading, setFlushLoading] = useState(false);
  const [mainWallet, setMainWallet] = useState("");
  const [pairingToken, setPairingToken] = useState("");
  
  // IMPROVEMENT: Staff List Persistence
  const [staffList, setStaffList] = useState<{name: string, address: string}[]>([]);
  const [currentStaffName, setCurrentStaffName] = useState("");
  const [currentStaffAddress, setCurrentStaffAddress] = useState("");

  // Load staff from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('opayque_staff');
    if (saved) setStaffList(JSON.parse(saved));
  }, []);

  const handleRegister = () => {
    if (!currentStaffName || !currentStaffAddress) return;
    const newList = [...staffList, { name: currentStaffName, address: currentStaffAddress }];
    setStaffList(newList);
    localStorage.setItem('opayque_staff', JSON.stringify(newList));
    setCurrentStaffName("");
    setCurrentStaffAddress("");
    alert(`${currentStaffName} authorized as Endpoint.`);
  };

  const generatePairingToken = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingToken(code);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter">OPAYQUE<span className="text-purple-500">.</span></h1>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Privacy-Shielded Merchant Admin</p>
          </div>
          <WalletMultiButton className="!bg-white !text-black !rounded-full !font-bold !text-xs" />
        </div>

        {connected ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* LEFT: Financials */}
            <div className="lg:col-span-5 space-y-8">
              <div className="p-10 rounded-[3.5rem] bg-zinc-900/50 border border-purple-500/20 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl italic font-black">TEE</div>
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Shielded Vault</p>
                <h2 className="text-6xl font-mono font-bold tracking-tighter">
                    {formatUSDC(privateBalance)}
                </h2>
                
                <div className="mt-12 space-y-4">
                    <input 
                        className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-xs outline-none focus:border-purple-500 transition-all"
                        placeholder="Settlement L1 Address (Public)"
                        value={mainWallet}
                        onChange={(e) => setMainWallet(e.target.value)}
                    />
                    <button 
                        onClick={() => { setFlushLoading(true); setTimeout(() => { setPrivateBalance(0); setFlushLoading(false); }, 2000); }}
                        className="w-full py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        {flushLoading ? "Executing TEE Flush..." : "Settle to Main Wallet"}
                    </button>
                </div>
              </div>

              {/* RECENT SETTLEMENTS (Padding) */}
              <div className="p-8 bg-zinc-900/30 border border-white/5 rounded-[2.5rem]">
                 <h4 className="text-[9px] uppercase font-bold text-zinc-500 tracking-[0.2em] mb-4">Audit Ledger</h4>
                 <div className="space-y-3">
                    {[1, 2].map(i => (
                        <div key={i} className="flex justify-between items-center text-[10px] font-mono opacity-40">
                            <span>SHIELD_SETTLE_0x...{i}f4</span>
                            <span className="text-green-500">+$450.00</span>
                        </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* RIGHT: Operations */}
            <div className="lg:col-span-7 space-y-8">
              {/* TERMINAL PAIRING */}
              <div className="p-8 bg-zinc-900/80 border border-white/5 rounded-[3rem] flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest">Device Pairing</h3>
                    <p className="text-[10px] text-zinc-500">Authorize active terminals</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-mono font-black text-purple-400 tracking-widest">{pairingToken || "------"}</span>
                    <button onClick={generatePairingToken} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
                        🔄
                    </button>
                </div>
              </div>

              {/* STAFF ONBOARDING */}
              <div className="p-10 bg-zinc-900 border border-white/5 rounded-[3.5rem]">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-8">Manage Endpoints</h3>
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <input 
                            placeholder="STAFF NAME"
                            className="flex-1 bg-black border border-white/5 p-4 rounded-2xl text-xs"
                            value={currentStaffName}
                            onChange={(e) => setCurrentStaffName(e.target.value)}
                        />
                        <input 
                            placeholder="SOLANA WALLET"
                            className="flex-[2] bg-black border border-white/5 p-4 rounded-2xl text-[10px] font-mono"
                            value={currentStaffAddress}
                            onChange={(e) => setCurrentStaffAddress(e.target.value)}
                        />
                    </div>
                    <button onClick={handleRegister} className="w-full py-4 bg-purple-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-colors">
                        Authorize Staff Member
                    </button>
                </div>

                {/* Staff Display */}
                <div className="mt-10 grid grid-cols-2 gap-4">
                    {staffList.map((staff, idx) => (
                        <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 shrink-0" />
                            <div className="overflow-hidden">
                                <p className="text-[10px] font-bold truncate">{staff.name}</p>
                                <p className="text-[8px] text-zinc-600 font-mono truncate">{staff.address}</p>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="py-40 text-center">
             <h2 className="text-zinc-600 uppercase text-xs font-bold tracking-[0.5em]">System Locked • Awaiting Merchant Key</h2>
          </div>
        )}
      </div>
    </div>
  );
}
