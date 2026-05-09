"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

// Sample data with more realistic fields
const samples = [
  { 
    id: "e1", 
    name: "Main Vault", 
    address: "8YAV5vV3Nf2zPx9WCjyqkFKTAa55Hjnhm8FDCAEHEM76", 
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=vault",
    category: "Shielded Infrastructure",
    createdAt: new Date().toISOString()
  },
  { 
    id: "e2", 
    name: "Lagos Terminal 01", 
    address: "Bv7V5vV3Nf2zPx9WCjyqkFKTAa55Hjnhm8FDCAEHEM76", 
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=terminal",
    category: "Retail Endpoint",
    createdAt: new Date().toISOString()
  }
];

export default function RegistryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [endpoints, setEndpoints] = useState(samples);
  const [vaultName, setVaultName] = useState("OPAYQUE");

  // 10. Reduced timeout to exactly 1.2 seconds + glow animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setAuthorized(true);
    }, 1200); 
    return () => clearTimeout(timer);
  }, []);

  // 4. Unpair functionality
  const handleUnpair = () => {
    if (confirm("Unpair this terminal? New pairing code will be required.")) {
      localStorage.removeItem('paired_device_token');
      router.push('/login');
    }
  };

  // 5. Refresh code
  const refreshCode = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <div className="w-32 h-32 rounded-full bg-violet-600/30 animate-pulse duration-500 blur-2xl" />
        <p className="mt-8 text-violet-400 font-mono tracking-widest uppercase">
          Awaiting Merchant Authorization...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8 font-mono text-white">
      <header className="mb-12 flex justify-between items-center border-b border-white/10 pb-4">
        <div>
          <h1 
            className="text-2xl font-bold tracking-tighter cursor-pointer hover:text-violet-400 transition-colors"
            onClick={() => {
              const newName = prompt("Enter new vault name:", vaultName);
              if (newName) setVaultName(newName);
            }}
          >
            {vaultName} <span className="text-[10px] text-violet-500 italic opacity-70">(click to edit)</span>
          </h1>
          <p className="text-xs text-white/40">Shielded Registry • Mainnet-Beta v1.0.4</p>
        </div>
        
        <div className="flex gap-4">
          <button onClick={refreshCode} className="text-[10px] border border-white/20 px-3 py-1.5 hover:bg-white hover:text-black rounded-xl">
            REFRESH CODE
          </button>
          <button onClick={handleUnpair} className="text-[10px] border border-red-500/50 text-red-500 px-3 py-1.5 hover:bg-red-500 hover:text-white rounded-xl">
            UNPAIR TERMINAL
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {endpoints.map((endpoint) => (
          <motion.div 
            key={endpoint.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/10 bg-zinc-950 p-6 rounded-sm hover:border-violet-500/50 transition-colors"
          >
            <div className="flex items-center gap-4 mb-4">
              <img src={endpoint.image} alt="Identicon" className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5" />
              <div>
                <h3 className="text-sm font-bold">{endpoint.name}</h3>
                <p className="text-[10px] text-white/40">{endpoint.category}</p>
              </div>
            </div>
            
            <div className="bg-black p-3 rounded-sm mb-4 border border-white/5">
              <p className="text-[10px] text-violet-400 break-all leading-relaxed">
                {endpoint.address}
              </p>
            </div>

            {/* QR without picture overlay */}
            <div className="flex justify-center p-4 bg-white rounded-sm">
              <div className="w-32 h-32 bg-slate-200 flex items-center justify-center text-black text-[10px] font-mono">
                SCAN TO TRANSFER
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
