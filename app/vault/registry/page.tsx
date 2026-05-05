"use client";

import React, { useEffect, useState } from "react";
import EndpointRegistry from "@/components/EndpointRegistry";
import TerminalManager from "@/components/TerminalManager";
import { Endpoint, Terminal } from "@/lib/types";
import QRCode from "react-qr-code";

export default function RegistryPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);

  // Safe hydration
  useEffect(() => {
    try {
      const savedEndpoints = localStorage.getItem("opayque_endpoints");
      const savedTerminals = localStorage.getItem("opayque_terminals");

      if (savedEndpoints) setEndpoints(JSON.parse(savedEndpoints));
      if (savedTerminals) setTerminals(JSON.parse(savedTerminals));
      else {
        setTerminals([
          { id: "term_042", label: "Terminal_v1_042", status: "online", lastSeen: Date.now() },
        ]);
      }
    } catch (error) {
      console.error("Failed to load local data:", error);
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
    if (selectedEndpoint?.id === id) setSelectedEndpoint(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBroadcast = (endpoint: Endpoint) => {
    const checkoutUrl = `${window.location.origin}/vault/checkout?endpoint=${endpoint.id}`;
    alert(`Broadcasting QR for ${endpoint.label}: ${checkoutUrl}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* LEFT COLUMN */}
      <div className="lg:col-span-4 space-y-8">
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
            New Registration
          </h2>
          <EndpointRegistry onSave={handleSaveEndpoint} existingEndpoints={endpoints} />
        </section>

        <section>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
            Hardware Fleet
          </h2>
          <TerminalManager terminals={terminals} setTerminals={setTerminals} />
        </section>

        {selectedEndpoint && (
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
              QR for {selectedEndpoint.label}
            </h2>
            <div className="bg-zinc-900/40 p-6 rounded-2xl space-y-4">
              <QRCode
                value={`${window.location.origin}/vault/checkout?endpoint=${selectedEndpoint.id}`}
                size={128}
              />
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handlePrint}
                  className="px-6 py-3 bg-zinc-800 rounded-xl hover:bg-zinc-700"
                >
                  Print
                </button>
                <button
                  onClick={() => handleBroadcast(selectedEndpoint)}
                  className="px-6 py-3 bg-purple-600 rounded-xl hover:bg-purple-500"
                >
                  Broadcast
                </button>
              </div>
            </div>
          </section>
        )}
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
                {endpoints.length} Verified Recipient{endpoints.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                className="p-4 bg-zinc-900 rounded-xl flex justify-between items-center"
              >
                <div>
                  <p className="font-bold">{ep.label}</p>
                  <p className="text-xs text-zinc-500">{ep.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedEndpoint(ep)}
                    className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-500 text-xs"
                  >
                    Show QR
                  </button>
                  <button
                    onClick={() => handleDeleteEndpoint(ep.id)}
                    className="px-3 py-1 bg-red-600 rounded hover:bg-red-500 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}