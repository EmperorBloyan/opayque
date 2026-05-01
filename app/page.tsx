"use client";

import React, { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { QRCodeSVG } from "qrcode.react";

interface Endpoint {
  id: string;
  name: string;
  address: string;
  type: "employee" | "cause";
}

export default function MerchantAdmin() {
  const { publicKey, connected } = useWallet();
  
  // 1. DYNAMIC IDENTITY
  // The "Main Vault" now defaults to the connected merchant's wallet
  const merchantBaseAddress = useMemo(() => 
    publicKey ? publicKey.toBase58() : "Connect Wallet to Initialize", 
    [publicKey]
  );

  const [endpoints, setEndpoints] = useState<Endpoint[]>([
    { id: "default", name: "Main Store Vault", address: merchantBaseAddress, type: "employee" },
  ]);

  const [transactions] = useState([
    { id: 'tx1', type: 'Product Sale', amount: 50.00, status: 'Shielded', date: '2026-04-29' },
    { id: 'tx2', type: 'Staff Tip', amount: 5.50, status: 'Shielded', date: '2026-04-29' },
  ]);

  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newType, setNewType] = useState<"employee" | "cause">("employee");
  const [activeQR, setActiveQR] = useState<Endpoint | null>(null);

  const addEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAddress) return;
    setEndpoints([...endpoints, { id: Date.now().toString(), name: newName, address: newAddress, type: newType }]);
    setNewName("");
    setNewAddress("");
  };

  const deleteEndpoint = (id: string) => {
    if (id === "default") return; // Prevent deleting the main vault
    setEndpoints(endpoints.filter(e => e.id !== id));
    if (activeQR?.id === id) setActiveQR(null);
  };

  // 2. SOLANA PAY URI GENERATOR
  const getSolanaPayUri = (targetAddress: string, label: string) => {
    // Standard format: solana:<address>?label=<label>&message=<msg>
    const cleanLabel = encodeURIComponent(`Opayque: ${label}`);
    return `solana:${targetAddress}?label=${cleanLabel}&message=Confidential+Shielded+Transfer`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">Opayque Admin</h1>
            <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`}></div>
                <p className="text-zinc-500 text-xs uppercase tracking-widest">
                    {connected ? `Active Terminal: ${merchantBaseAddress.slice(0,4)}...${merchantBaseAddress.slice(-4)}` : "Terminal Offline - Connect Wallet"}
                </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => alert("Generating Audit Report...")} className="hidden md:block px-5 py-2 bg-zinc-900 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all">
                Compliance Export
            </button>
            <WalletMultiButton />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MANAGEMENT FORM */}
          <div className="space-y-6">
            <section className="bg-zinc-900/50 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                Endpoint Registry
              </h2>
              <form onSubmit={addEndpoint} className="space-y-4">
                <input 
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="Employee Name / Cause"
                  className="w-full bg-black border border-white/5 rounded-2xl p-4 outline-none focus:border-purple-500/50 transition-all text-sm"
                />
                <input 
                  value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Solana Address"
                  className="w-full bg-black border border-white/5 rounded-2xl p-4 outline-none focus:border-purple-500/50 transition-all font-mono text-xs"
                />
                <div className="flex gap-2 p-1 bg-black rounded-2xl border border-white/5">
                  <button type="button" onClick={() => setNewType("employee")} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${newType === 'employee' ? 'bg-white text-black' : 'text-zinc-500'}`}>Staff</button>
                  <button type="button" onClick={() => setNewType("cause")} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${newType === 'cause' ? 'bg-white text-black' : 'text-zinc-500'}`}>Cause</button>
                </div>
                <button type="submit" disabled={!connected} className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded-2xl font-bold transition-all mt-4">
                  Register Endpoint
                </button>
              </form>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* DIRECTORY */}
            <section className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h2 className="text-lg font-bold">Directory Management</h2>
              </div>
              <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
                {endpoints.map((ep) => (
                  <div key={ep.id} className="p-6 flex items-center justify-between hover:bg-white/[0.02]">
                    <div className="max-w-[60%]">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${ep.type === 'employee' ? 'bg-blue-400' : 'bg-green-400'}`}></span>
                        <h3 className="font-bold truncate">{ep.name}</h3>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600 truncate">{ep.address}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveQR(ep)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase">Get QR</button>
                      {ep.id !== "default" && (
                        <button onClick={() => deleteEndpoint(ep.id)} className="px-4 py-2 text-red-500/40 hover:text-red-500 text-[10px] font-bold uppercase">Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* AUDIT LOG */}
            <section className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold">Private Shielded Ledger</h2>
                <div className="text-right">
                   <p className="text-[10px] text-zinc-500 uppercase font-bold">Vault Balance</p>
                   <p className="text-2xl font-mono font-bold">$55.50 <span className="text-sm text-zinc-500 font-normal italic">USDC</span></p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="p-4 text-[10px] uppercase text-zinc-500">Source</th>
                      <th className="p-4 text-[10px] uppercase text-zinc-500">Amount</th>
                      <th className="p-4 text-[10px] uppercase text-zinc-500">Privacy</th>
                      <th className="p-4 text-[10px] uppercase text-zinc-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/[0.01]">
                        <td className="p-4 text-sm font-medium">{tx.type}</td>
                        <td className="p-4 text-sm font-mono text-green-400 font-bold">+${tx.amount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase rounded border border-purple-500/20">Shielded</span>
                        </td>
                        <td className="p-4 text-sm text-zinc-500 font-mono">{tx.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
                 <button onClick={() => alert("TEE Settlement Logic Initiated...")} className="px-10 py-4 bg-white text-black font-bold rounded-2xl hover:scale-105 transition-all shadow-xl">
                   Flush to L1 Mainnet
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* QR MODAL */}
        {activeQR && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-6">
            <div className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] max-w-sm w-full text-center animate-in zoom-in duration-300">
              <h3 className="text-2xl font-bold mb-1">{activeQR.name}</h3>
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest mb-8">Ready for Shielded Pay</p>
              <div className="p-6 bg-white rounded-[2.5rem] inline-block mb-10 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                <QRCodeSVG value={getSolanaPayUri(activeQR.address, activeQR.name)} size={200} />
              </div>
              <button onClick={() => setActiveQR(null)} className="w-full py-4 bg-white/5 text-zinc-400 rounded-2xl font-bold uppercase text-xs">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}