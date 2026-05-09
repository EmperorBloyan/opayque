"use client";

import React, { useState } from "react";
import ProfileCircle from "./ui/ProfileCircle";
import { 
  LucideWallet, 
  LucideUser, 
  LucideCheckCircle, 
  LucideAlertCircle, 
  LucideHeart, 
  LucideCircleDollarSign,
  LucideUsers
} from "lucide-react";
import { Endpoint, EndpointCategory } from "@/lib/types";
import { PublicKey } from "@solana/web3.js";

interface EndpointRegistryProps {
  onSave: (data: Endpoint) => void;
  existingEndpoints: Endpoint[]; // Needed for duplicate check
}

export default function EndpointRegistry({ onSave, existingEndpoints }: EndpointRegistryProps) {
  const [category, setCategory] = useState<EndpointCategory>("Staff");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [image, setImage] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateAddress = (addr: string) => {
    try {
      new PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    setError(null);
    
    if (!name || !address) {
      setError("Please fill in all fields");
      return;
    }

    if (!validateAddress(address)) {
      setError("Invalid Solana Address");
      return;
    }

    const isDuplicate = existingEndpoints.some(e => e.address === address);
    if (isDuplicate) {
      setError("This wallet address is already registered");
      return;
    }

    const newEndpoint: Endpoint = {
      id: crypto.randomUUID(),
      name,
      address,
      category,
      image, // ✅ include uploaded image
      createdAt: Date.now()
    };

    onSave(newEndpoint);
    setSuccess(true);

    setTimeout(() => {
      setSuccess(false);
      setName("");
      setAddress("");
      setImage(undefined);
    }, 1200);
  };

  return (
    <div className="p-8 bg-zinc-900/50 border border-white/5 rounded-[3rem] shadow-2xl backdrop-blur-sm relative overflow-hidden">
      {success && (
        <div className="absolute inset-0 bg-purple-600/20 backdrop-blur-xl flex flex-col items-center justify-center z-20 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-full p-4 mb-4 shadow-2xl animate-bounce">
            <LucideCheckCircle size={40} className="text-purple-600" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Entry Secured</p>
        </div>
      )}

      <div className="flex flex-col items-center mb-8">
        <ProfileCircle 
          image={image} 
          onUpload={setImage} 
          size="lg" 
          label="Set Endpoint Identity" 
        />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mt-4">
          Establish Identity
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/5" role="group">
          {[
            { label: "Staff", icon: <LucideUsers size={12} />, value: "Staff" },
            { label: "Cause", icon: <LucideHeart size={12} />, value: "Cause" },
            { label: "Tips", icon: <LucideCircleDollarSign size={12} />, value: "Tips" }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setCategory(item.value as EndpointCategory)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                category === item.value ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="relative group">
            <LucideUser className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-400 transition-colors" size={16} />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name / Cause Name"
              className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-purple-500/50 transition-all outline-none"
            />
          </div>

          <div className="relative group">
            <LucideWallet className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-purple-400 transition-colors" size={16} />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Recipient Wallet Address"
              className={`w-full bg-black/40 border ${error ? 'border-red-500/50' : 'border-white/5'} rounded-2xl py-4 pl-12 pr-4 text-sm font-mono focus:border-purple-500/50 transition-all outline-none`}
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase tracking-tighter px-2 animate-in slide-in-from-left-2">
              <LucideAlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={success}
          className="group relative w-full py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs overflow-hidden hover:bg-purple-500 transition-all active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
             Sign & Register
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>
      </div>
    </div>
  );
}