"use client";

import React, { useEffect } from "react";
import { LucideHardDrive, LucidePlusCircle, LucideRefreshCw, LucideTrash2 } from "lucide-react";
import type { Terminal } from "@/lib/types";

interface TerminalManagerProps {
  terminals?: Terminal[];
  setTerminals?: React.Dispatch<React.SetStateAction<Terminal[]>>;
}

function createAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizeTerminals(items: Terminal[] = []): Terminal[] {
  return items.map((terminal) => ({
    ...terminal,
    status: terminal.status ?? "online",
    lastSeen: terminal.lastSeen ?? Date.now(),
    accessCode: terminal.accessCode ?? createAccessCode(),
    isActive: Boolean(terminal.isActive),
    lastLoginAt: terminal.lastLoginAt ?? null,
  }));
}

export default function TerminalManager({ terminals = [], setTerminals }: TerminalManagerProps) {
  const safeTerminals = normalizeTerminals(terminals);

  const persistTerminals = (updated: Terminal[]) => {
    setTerminals?.(updated);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("opayque_terminals", JSON.stringify(updated));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem("opayque_terminals");
      if (stored) {
        const parsed = JSON.parse(stored) as Terminal[];
        const normalized = normalizeTerminals(parsed);
        setTerminals?.(normalized);
        if (JSON.stringify(normalized) !== stored) {
          window.localStorage.setItem("opayque_terminals", JSON.stringify(normalized));
        }
        return;
      }
    } catch {
      // Ignore malformed storage data.
    }

    if (terminals.length === 0) {
      const sample: Terminal[] = [
        {
          id: "t1",
          label: "POS Terminal 01",
          status: "online",
          lastSeen: Date.now(),
          accessCode: createAccessCode(),
          isActive: false,
          lastLoginAt: null,
        },
        {
          id: "t2",
          label: "Kiosk Terminal 02",
          status: "online",
          lastSeen: Date.now(),
          accessCode: createAccessCode(),
          isActive: false,
          lastLoginAt: null,
        },
      ];
      persistTerminals(sample);
    }
  }, [setTerminals, terminals.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      try {
        const stored = window.localStorage.getItem("opayque_terminals");
        if (stored) {
          const parsed = JSON.parse(stored) as Terminal[];
          setTerminals?.(normalizeTerminals(parsed));
        }
      } catch {
        // Ignore malformed storage data.
      }
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener("opayque-terminal-login", syncFromStorage as EventListener);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener("opayque-terminal-login", syncFromStorage as EventListener);
    };
  }, [setTerminals]);

  const refreshCodes = () => {
    const updated = safeTerminals.map((terminal) => ({
      ...terminal,
      accessCode: createAccessCode(),
      isActive: false,
      lastLoginAt: null,
    }));
    persistTerminals(updated);
  };

  const pairNewTerminal = () => {
    const updated = [
      ...safeTerminals,
      {
        id: `t${Date.now()}`,
        label: `Fleet Terminal ${safeTerminals.length + 1}`,
        status: "online" as const,
        lastSeen: Date.now(),
        accessCode: createAccessCode(),
        isActive: false,
        lastLoginAt: null,
      },
    ];
    persistTerminals(updated);
  };

  const disconnectTerminal = (id: string) => {
    if (confirm("Unpair this terminal? New pairing code required to log in again.")) {
      const updated = safeTerminals.filter((terminal) => terminal.id !== id);
      persistTerminals(updated);
    }
  };

  return (
    <div className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] shadow-xl relative overflow-hidden group/fleet">
      <div className="flex justify-between items-start mb-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">Hardware Fleet</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${safeTerminals.length > 0 ? "bg-green-500 animate-pulse" : "bg-zinc-800"}`} />
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
              {safeTerminals.length} SECURED NODES
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refreshCodes}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <LucideRefreshCw size={14} /> Refresh Code
          </button>
          <button
            onClick={pairNewTerminal}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <LucidePlusCircle size={14} /> Pair New
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {safeTerminals.map((terminal) => (
          <div key={terminal.id} className="flex items-center justify-between p-5 bg-black/40 rounded-[2.5rem] border border-white/5 hover:border-purple-500/30 transition-all">
            <div className="flex items-center gap-3">
              <LucideHardDrive size={22} />
              <div>
                <p className="font-medium">{terminal.label}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-500 mt-1">
                  Code: {terminal.accessCode}
                </p>
                <p className={`text-xs ${terminal.isActive ? "text-amber-500" : "text-green-500"}`}>
                  {terminal.isActive ? "Active • Staff logged in" : "Ready • Awaiting staff login"}
                </p>
              </div>
            </div>
            <button
              onClick={() => disconnectTerminal(terminal.id)}
              className="text-red-500 hover:text-red-400 p-2"
            >
              <LucideTrash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
