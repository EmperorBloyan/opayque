"use client";

import React, { useState } from "react";
import { Endpoint, EndpointCategory } from "@/lib/types";
import { 
  LucideTrash2, 
  LucideExternalLink, 
  LucideSend, 
  LucideUserCircle2,
  LucideSearch
} from "lucide-react";

interface EndpointListProps {
  endpoints: Endpoint[];
  onDelete: (id: string) => void;
}

export default function EndpointList({ endpoints, onDelete }: EndpointListProps) {
  const [filter, setFilter] = useState<EndpointCategory | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEndpoints = endpoints.filter(e => {
    const matchesFilter = filter === "All" || e.category === filter;
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/30 p-4 rounded-[2rem] border border-white/5">
        <div className="flex bg-black p-1 rounded-xl border border-white/5 w-full md:w-auto">
          {["All", "Staff", "Cause", "Tips"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as any)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                filter === cat ? "bg-white text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <LucideSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
          <input 
            type="text"
            placeholder="Search Registry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black border border-white/5 rounded-xl py-2 pl-10 pr-4 text-[10px] uppercase font-bold tracking-widest focus:border-purple-500/50 outline-none transition-all"
          />
        </div>
      </div>

      {/* GRID OF ENDPOINTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEndpoints.length > 0 ? (
          filteredEndpoints.map((endpoint) => (
            <div 
              key={endpoint.id}
              className="group relative bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6 hover:border-purple-500/30 transition-all hover:shadow-2xl hover:shadow-purple-500/5 overflow-hidden"
            >
              <div className="flex items-center gap-5">
                {/* PERSISTENT PHOTO */}
                <div className="w-16 h-16 rounded-full bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                  {endpoint.image ? (
                    <img src={endpoint.image} alt={endpoint.name} className="w-full h-full object-cover" />
                  ) : (
                    <LucideUserCircle2 size={32} className="text-zinc-800" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-black tracking-tight text-white truncate uppercase italic">
                      {endpoint.name}
                    </h4>
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded-md text-[8px] font-black uppercase tracking-tighter">
                      {endpoint.category}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 truncate">
                    {endpoint.address}
                  </p>
                </div>

                {/* QUICK ACTIONS */}
                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onDelete(endpoint.id)}
                    className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                    title="Remove from Registry"
                  >
                    <LucideTrash2 size={14} />
                  </button>
                  <a 
                    href={`https://solscan.io/account/${endpoint.address}`} 
                    target="_blank"
                    className="p-2 bg-white/5 text-zinc-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                  >
                    <LucideExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <button className="mt-6 w-full py-3 bg-white/5 hover:bg-white text-zinc-400 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group/btn">
                <LucideSend size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                Initiate Settlement
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] opacity-40">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
              No Entries Found in {filter}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}