"use client";

import React, { useEffect } from "react";
import { LucideHardDrive, LucidePlusCircle, LucideRefreshCw, LucideTrash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getActiveSession } from "@/lib/crypto/session";
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
  const merchantId = getActiveSession()?.merchantId ?? "00000000-0000-0000-0000-000000000000";

  const loadFromSupabase = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("terminals")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("last_active", { ascending: false });

      if (error) {
        throw error;
      }

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        label: row.terminal_label ?? "Fleet Terminal",
        status: row.status === "online" ? "online" : "offline",
        lastSeen: row.last_active ? new Date(row.last_active).getTime() : Date.now(),
        accessCode: row.device_token ?? createAccessCode(),
        isActive: row.status === "online",
        lastLoginAt: row.last_active ? new Date(row.last_active).getTime() : null,
      }));

      setTerminals?.(mapped);
    } catch (error) {
      console.error("Failed to load terminals from Supabase", error);
    }
  };

  const persistTerminals = async (updated: Terminal[]) => {
    setTerminals?.(updated);

    try {
      const supabase = createSupabaseBrowserClient();
      await Promise.all(
        updated.map(async (terminal) => {
          const payload = {
            id: terminal.id,
            merchant_id: merchantId,
            terminal_label: terminal.label,
            device_token: terminal.accessCode ?? createAccessCode(),
            status: terminal.isActive ? "online" : "offline",
            last_active: terminal.lastLoginAt ? new Date(terminal.lastLoginAt).toISOString() : new Date().toISOString(),
          };

          const { error } = await supabase.from("terminals").upsert(payload, { onConflict: "id" });
          if (error) {
            throw error;
          }
        })
      );
      await loadFromSupabase();
    } catch (error) {
      console.error("Failed to sync terminals to Supabase", error);
    }
  };

  useEffect(() => {
    void loadFromSupabase();
  }, [merchantId]);

  const refreshCodes = async () => {
    const updated = safeTerminals.map((terminal) => ({
      ...terminal,
      accessCode: createAccessCode(),
      isActive: false,
      lastLoginAt: null,
      status: "offline" as const,
    }));
    await persistTerminals(updated);
  };

  const pairNewTerminal = async () => {
    const updated = [
      ...safeTerminals,
      {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        label: `Fleet Terminal ${safeTerminals.length + 1}`,
        status: "offline" as const,
        lastSeen: Date.now(),
        accessCode: createAccessCode(),
        isActive: false,
        lastLoginAt: null,
      },
    ];
    await persistTerminals(updated);
  };

  const disconnectTerminal = async (id: string) => {
    if (confirm("Unpair this terminal? New pairing code required to log in again.")) {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.from("terminals").delete().eq("id", id);
        if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Failed to delete terminal from Supabase", error);
      }

      const updated = safeTerminals.filter((terminal) => terminal.id !== id);
      await persistTerminals(updated);
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
            onClick={() => void refreshCodes()}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white text-zinc-500 hover:text-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <LucideRefreshCw size={14} /> Refresh Code
          </button>
          <button
            onClick={() => void pairNewTerminal()}
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
              onClick={() => void disconnectTerminal(terminal.id)}
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
