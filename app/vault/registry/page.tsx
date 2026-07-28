"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

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
  const [endpoints, setEndpoints] = useState(samples);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200); 
    return () => clearTimeout(timer);
  }, []);

  const handleUnpair = () => {
    localStorage.removeItem('paired_device_token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black fixed inset-0 z-[100]">
        <div className="w-32 h-32 rounded-full bg-violet-600/30 animate-pulse duration-400 blur-2xl" />
        <p className="mt-8 text-violet-400 font-mono tracking-widest uppercase text-[10px]">
          Awaiting Merchant Authorization...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 font-mono text-white relative z-10">
      <header className="mb-12 flex justify-between items-start border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tighter">
            OPAYQUE <span className="text-[9px] text-violet-500 italic opacity-70 block sm:inline">(click to edit vault name)</span>
          </h1>
          <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">Shielded Registry • v1.0.4</p>
        </div>
        
        <div className="flex gap-3">
          <button onClick={() => setEndpoints([...samples])} className="text-[9px] border border-white/20 px-3 py-1.5 hover:bg-white hover:text-black transition-all">
            REFRESH CODE
          </button>
          <button onClick={handleUnpair} className="text-[9px] border border-red-500/40 text-red-500 px-3 py-1.5 hover:bg-red-500 hover:text-white transition-all">
            UNPAIR
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {endpoints.map((endpoint) => (
          <motion.div 
            key={endpoint.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/5 bg-zinc-950/50 p-5 rounded-sm hover:border-violet-500/30 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-6">
              <img src={endpoint.image} alt="ID" className="w-8 h-8 rounded-full border border-white/10 bg-black" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight">{endpoint.name}</h3>
                <p className="text-[9px] text-white/30 uppercase">{endpoint.category}</p>
              </div>
            </div>
            
            <div className="bg-black/50 p-3 rounded-sm mb-6 border border-white/5 group-hover:border-violet-500/20">
              <p className="text-[9px] text-violet-400/80 break-all font-mono leading-relaxed">
                {endpoint.address}
              </p>
            </div>

            <div className="flex justify-center p-6 bg-white rounded-[2px] cursor-pointer hover:opacity-90 transition-opacity">
               <div className="w-24 h-24 bg-white border-8 border-white flex items-center justify-center text-black text-[8px] font-bold text-center border-double border-black">
                 [ SCAN FOR <br/> SHIELDED TX ]
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
