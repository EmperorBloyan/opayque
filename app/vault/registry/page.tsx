"use client";

import React, { useState, useEffect } from "react";
import EndpointRegistry from "@/components/EndpointRegistry";
import EndpointList from "@/components/EndpointList";
import TerminalManager from "@/components/TerminalManager";
import { Endpoint, Terminal } from "@/lib/types";

export default function RegistryPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  // 1. SAFE HYDRATION (Error Handling)
  useEffect(() => {
    try {
      const savedEndpoints = localStorage.getItem("opayque_endpoints");
      const savedTerminals = localStorage.getItem("opayque_terminals");
      
      if (savedEndpoints) setEndpoints(JSON.parse(savedEndpoints));
      if (savedTerminals) setTerminals(JSON.parse(savedTerminals));
      else {
        // Default terminal if none exist
        setTerminals([{ id: 'term_042', label: 'Terminal_v1_042', status: 'online', lastSeen: Date.now() }]);
      }
    } catch (error) {
      console.error("Failed to load local data:", error);
      // Optional: Clear corrupted data
      // localStorage.clear();
    }
  }, []);

  const handleSaveEndpoint = (newEndpoint: Endpoint) => {
    const updated = [newEndpoint, ...endpoints];
    setEndpoints(updated);
    localStorage.setItem("opayque_endpoints", JSON.stringify(updated));
  };

  const handleDeleteEndpoint = (id: string) => {
    const updated = endpoints.filter((e) => e.id !== id);
    setEndpoints(updated);
    localStorage.setItem("opayque_endpoints", JSON.stringify(updated));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN */}
      <div className="lg:col-span-4 space-y-8">
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
            New Registration
          </h2>
          <EndpointRegistry 
            onSave={handleSaveEndpoint} 
            existingEndpoints={endpoints} // Fixed Prop Mismatch
          />
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
            Hardware Fleet
          </h2>
          <TerminalManager terminals={terminals} setTerminals={setTerminals} />
        </section>
      </div>

      {/* RIGHT COLUMN */}
      <div className="lg:col-span-8">
        <section className="bg-zinc-900/20 border border-white/5 rounded-[3.5rem] p-8 min-h-[700px]">
          <div className="flex justify-between items-end mb-10 px-4">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">
                Active Fleet
              </h2>
              <p className="text-3xl font-black italic tracking-tighter uppercase text-white">
                Universal Registry
              </p>
            </div>
            <div className="text-right">
              <span className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                {endpoints.length} Verified Recipient{endpoints.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <EndpointList 
            endpoints={endpoints} 
            onDelete={handleDeleteEndpoint} 
          />
        </section>
      </div>
    </div>
  );
}