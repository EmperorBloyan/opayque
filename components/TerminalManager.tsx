"use client";

import React, { useEffect, useState } from "react";
import { LucideHardDrive, LucideBell, LucidePlus, LucideTrash2, LucideRefreshCw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getActiveMerchantId } from "@/lib/crypto/session";
import type { Terminal } from "@/lib/types";
import PairingModal from "./PairingModal";

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
  const merchantId = getActiveMerchantId();
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [authCode, setAuthCode] = useState(""
  );
  const [timeLeft, setTimeLeft] = useState("09M 57S");

  useEffect(() => {
    if (!authCode) {
      setAuthCode(createAccessCode());
    }
  }, [authCode]);

  useEffect(() => {
    if (!isPairingOpen) return;
    const target = Date.now() + 9 * 60 * 1000 + 57 * 1000;
    const tick = () => {
      const remaining = Math.max(0, target - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}M ${String(secs).padStart(2, "0")}S`);
      if (remaining === 0) {
        setAuthCode(createAccessCode());
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [isPairingOpen]);

  const refreshAuthCode = () => {
    setAuthCode(createAccessCode());
    setTimeLeft("09M 57S");
  };

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
      if (mapped.length > 0 && !authCode) {
        setAuthCode(mapped[0].accessCode ?? createAccessCode());
      }
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
    setAuthCode(updated[0]?.accessCode ?? createAccessCode());
    setTimeLeft("09M 57S");
  };

  const pairNewTerminal = async () => {
    const newTerminal = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      label: `Fleet Terminal ${safeTerminals.length + 1}`,
      status: "offline" as const,
      lastSeen: Date.now(),
      accessCode: createAccessCode(),
      isActive: false,
      lastLoginAt: null,
    };

    const updated = [...safeTerminals, newTerminal];
    await persistTerminals(updated);
    setAuthCode(newTerminal.accessCode);
    setTimeLeft("09M 57S");
    setIsPairingOpen(true);
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
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0d0d11] p-6 shadow-2xl shadow-black/40">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LucideBell size={14} className="text-zinc-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Hardware Fleet</h3>
          </div>
          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">
            • {safeTerminals.length} secured nodes
          </p>
        </div>

        <button
          onClick={() => {
            setAuthCode(createAccessCode());
            setTimeLeft("09M 57S");
            setIsPairingOpen(true);
          }}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-zinc-200"
        >
          <LucidePlus size={14} /> Pair New
        </button>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-[#050507] p-6">
        {safeTerminals.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-zinc-500">
              <LucideHardDrive size={24} />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">No Nodes Connected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {safeTerminals.map((terminal) => (
              <div key={terminal.id} className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-400">
                    <LucideHardDrive size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{terminal.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                      {terminal.isActive ? "Active • Staff logged in" : "Ready • Awaiting staff login"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => void disconnectTerminal(terminal.id)}
                  className="text-zinc-600 transition-all hover:text-red-500"
                  aria-label="Remove terminal"
                >
                  <LucideTrash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        authCode={authCode}
        onRefresh={refreshAuthCode}
        timeLeft={timeLeft}
      />
    </div>
  );
}
