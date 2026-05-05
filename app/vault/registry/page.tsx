"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LucideUserPlus, LucideRefreshCw, LucideCamera, LucideTrash2 } from "lucide-react";

// --- TYPE SAFETY ---
// Defined here for now, but move to types/vault.ts later
export interface VaultEndpoint {
  id: string;
  name: string;
  type: 'Staff' | 'Tips' | 'Cause';
  image?: string;
  createdAt: number;
}

export default function RegistryPage() {
  const [pairingToken, setPairingToken] = useState("");
  const [staffList, setStaffList] = useState<VaultEndpoint[]>([]);
  const [activeCategory, setActiveCategory] = useState<VaultEndpoint['type']>("Staff");

  // 1. INITIAL LOAD & EXPIRY CHECK
  useEffect(() => {
    const savedStaff = localStorage.getItem("opayque_staff");
    const savedTokenData = localStorage.getItem("opayque_token_meta");
    
    if (savedStaff) setStaffList(JSON.parse(savedStaff));
    
    if (savedTokenData) {
      const { code, timestamp } = JSON.parse(savedTokenData);
      const isExpired = Date.now() - timestamp > 86400000; // 24 Hours
      if (!isExpired) setPairingToken(code);
      else localStorage.removeItem("opayque_token_meta");
    }
  }, []);

  // 2. PERSISTENCE
  useEffect(() => {
    localStorage.setItem("opayque_staff", JSON.stringify(staffList));
  }, [staffList]);

  // 3. ACTIONS
  const generatePairingToken = useCallback(() => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setPairingToken(code);
    localStorage.setItem("opayque_token_meta", JSON.stringify({
      code,
      timestamp: Date.now()
    }));
  }, []);

  const updateEndpoint = (id: string, updates: Partial<VaultEndpoint>) => {
    setStaffList(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      updateEndpoint(id, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const addEndpoint = () => {
    const newEntry: VaultEndpoint = {
      id: crypto.randomUUID(),
      name: `New ${activeCategory}`,
      type: activeCategory,
      createdAt: Date.now()
    };
    setStaffList([newEntry, ...staffList]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN */}
      <div className="lg:col-span-4 space-y-6">
        <div className="p-8 bg-zinc-900 border border-white/5 rounded-[3rem] shadow-2xl">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6 text-zinc-500">Terminal Pairing</h3>
          <div className="flex items-center justify-between bg-black p-6 rounded-3xl border border-white/5 mb-4">
            <span className="text-4xl font-mono font-black text-purple-500 tracking-tighter">
              {pairingToken || "------"}
            </span>
            <button onClick={generatePairingToken} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all">
              <LucideRefreshCw size={20} />
            </button>
          </div>
          <p className="text-[9px] text-center text-zinc-600 font-bold uppercase tracking-tighter">
            {pairingToken ? "Active for 24h" : "Generate TEE Session"}
          </p>
        </div>

        <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem]">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 text-zinc-500">Registry Mode</h3>
          <div className="space-y-2">
            {["Staff", "Tips", "Cause"].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as any)}
                className={`w-full text-left px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-purple-600 text-white' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-8">
        <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] min-h-[500px]">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Endpoint Registry</h3>
            <button onClick={addEndpoint} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all">
              <LucideUserPlus size={14} /> Register {activeCategory}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staffList.length > 0 ? (
              staffList.map((s) => (
                <div key={s.id} className="group relative flex items-center gap-4 p-5 bg-black/40 rounded-[2rem] border border-white/5 hover:border-purple-500/50 transition-all">
                  
                  {/* UPLOADABLE IMAGE CIRCLE */}
                  <div className="relative w-16 h-16 shrink-0 group/avatar">
                    <div className="w-full h-full rounded-full bg-zinc-800 border-2 border-white/5 flex items-center justify-center overflow-hidden">
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <LucideCamera size={18} className="text-zinc-600" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(s.id, e)}
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                  </div>

                  <div className="flex-1">
                    <input 
                      type="text"
                      value={s.name}
                      onChange={(e) => updateEndpoint(s.id, { name: e.target.value })}
                      className="bg-transparent border-none p-0 text-sm font-bold tracking-tight focus:ring-0 w-full text-white"
                    />
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded text-[8px] font-black uppercase mt-1 inline-block">
                      {s.type}
                    </span>
                  </div>

                  <button onClick={() => setStaffList(prev => prev.filter(x => x.id !== s.id))} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-500 transition-all">
                    <LucideTrash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem]">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] mb-6">Registry Empty</p>
                <button onClick={addEndpoint} className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl text-[9px] font-black uppercase hover:bg-white/10 transition-all">
                  Register Your First Endpoint
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}