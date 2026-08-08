"use client";

import React, { useEffect, useState } from "react";
import { LucideHardDrive, LucideBell, LucidePlus, LucideTrash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getActiveMerchantId, getActiveSession, getStoredMerchantId } from "@/lib/crypto/session";
import { formatPairingCountdown, normalizePairingCode } from "@/lib/terminal/pairing";
import type { Terminal } from "@/lib/types";
import PairingModal from "./PairingModal";

interface TerminalManagerProps {
  terminals?: Terminal[];
  setTerminals?: React.Dispatch<React.SetStateAction<Terminal[]>>;
  showHeaderInput?: boolean;
}

function createAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createDefaultTerminalLabel() {
  const shortId = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `Terminal-${shortId}`;
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

async function resolveMerchantId(): Promise<string | null> {
  const storedMerchantId = getStoredMerchantId();
  if (storedMerchantId && isValidUuid(storedMerchantId)) {
    return storedMerchantId;
  }

  const session = getActiveSession();
  if (session?.merchantId && isValidUuid(session.merchantId)) {
    return session.merchantId;
  }

  if (!session?.walletAddress) {
    return null;
  }

  const supabase = createSupabaseBrowserClient();
  const { data: existingMerchant, error: fetchError } = await supabase
    .from("merchants")
    .select("id")
    .eq("wallet_address", session.walletAddress)
    .single();

  if (!fetchError && existingMerchant?.id) {
    return existingMerchant.id;
  }

  const merchantName = typeof window !== "undefined"
    ? window.localStorage.getItem("merchant_name")?.trim() || "Opayque Merchant"
    : "Opayque Merchant";

  const { data: insertedMerchant, error: insertError } = await supabase
    .from("merchants")
    .upsert({ wallet_address: session.walletAddress, merchant_name: merchantName }, { onConflict: "wallet_address" })
    .select()
    .single();

  if (insertError || !insertedMerchant?.id) {
    console.error("Failed to resolve or create merchant record", insertError);
    return null;
  }

  return insertedMerchant.id;
}

export default function TerminalManager({ terminals = [], setTerminals, showHeaderInput = true }: TerminalManagerProps) {
  const safeTerminals = normalizeTerminals(terminals);
  const [resolvedMerchantId, setResolvedMerchantId] = useState<string | null>(null);
  const [isLoadingTerminals, setIsLoadingTerminals] = useState(false);
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [timeLeft, setTimeLeft] = useState("10M 00S");
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);
  const [newTerminalLabel, setNewTerminalLabel] = useState("");
  const [pairingState, setPairingState] = useState<"idle" | "waiting" | "used">("idle");
  const [toast, setToast] = useState<string | null>(null);

  const pairingChannelRef = React.useRef<any | null>(null);
  const fleetChannelRef = React.useRef<any | null>(null);
  const labelRefreshTimer = React.useRef<number | null>(null);

  const closePairingModal = React.useCallback(() => {
    setIsPairingOpen(false);
    setPairingState("idle");
    setPairingExpiresAt(null);
    setTimeLeft("10M 00S");
  }, []);

  useEffect(() => {
    if (!isPairingOpen) return;
    if (!pairingExpiresAt) {
      setTimeLeft("10M 00S");
      return;
    }

    const tick = () => {
      const nextTime = formatPairingCountdown(pairingExpiresAt, "10M 00S");
      setTimeLeft(nextTime);
      if (nextTime === "00M 00S") {
        setAuthCode("");
        setPairingState("idle");
        setPairingExpiresAt(null);
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [isPairingOpen, pairingExpiresAt]);

  const refreshAuthCode = async (terminalLabelOverride?: string) => {
    if (isRefreshingCode) return;
    setIsRefreshingCode(true);

    try {
      const currentMerchantId = resolvedMerchantId ?? (await resolveMerchantId());
      if (!currentMerchantId) {
        throw new Error("Cannot create pairing code: merchant identity unavailable.");
      }

      const terminalLabelToUse = typeof terminalLabelOverride === "string"
        ? terminalLabelOverride.trim() || null
        : newTerminalLabel.trim() || null;

      if (typeof terminalLabelOverride === "string") {
        setNewTerminalLabel(terminalLabelToUse ?? "");
      }

      if (!terminalLabelToUse) {
        throw new Error("Please enter a terminal name before generating an auth code.");
      }

      const response = await fetch("/api/terminal/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", merchant_id: currentMerchantId, terminal_label: terminalLabelToUse }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Unable to create pairing code (status ${response.status})`);
      }

      const nextCode = String(payload.code ?? createAccessCode());
      setAuthCode(nextCode);
      const expiresAt = typeof payload.expiresAt === "string" ? new Date(payload.expiresAt).getTime() : Date.now() + 10 * 60 * 1000;
      setPairingExpiresAt(expiresAt);
      setTimeLeft(formatPairingCountdown(expiresAt, "10M 00S"));
      setPairingState("waiting");
      try {
        const supabase = createSupabaseBrowserClient();
        // clean previous channel
        if (pairingChannelRef.current) {
          void supabase.removeChannel(pairingChannelRef.current);
          pairingChannelRef.current = null;
        }

        const channel = supabase
          .channel(`pairing-${nextCode}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "terminal_pairing_codes", filter: `code=eq.${nextCode}` },
            (payload) => {
              const rec = payload.new as any;
              if (!rec) return;
              if (String(rec.status).toUpperCase() === "USED") {
                setPairingState("used");
                setToast("Terminal logged in — updating fleet list");
                void loadFromSupabase();
                window.setTimeout(() => {
                  closePairingModal();
                }, 900);
                void supabase.removeChannel(channel);
                pairingChannelRef.current = null;
              }
            }
          )
          .subscribe();

        pairingChannelRef.current = channel;
      } catch (err) {
        console.warn("Failed to subscribe to pairing-code updates", err);
      }
    } catch (error) {
      console.error("Failed to generate pairing code", error);
      const message = error instanceof Error ? error.message : "Unknown pairing-code generation error";
      window.alert(message);
      const fallback = createAccessCode();
      setAuthCode(fallback);
      const fallbackExpiresAt = Date.now() + 10 * 60 * 1000;
      setPairingExpiresAt(fallbackExpiresAt);
      setTimeLeft(formatPairingCountdown(fallbackExpiresAt, "10M 00S"));
      setPairingState("waiting");
    } finally {
      setIsRefreshingCode(false);
    }
  };

  const loadFromSupabase = async () => {
    if (!resolvedMerchantId) {
      return;
    }

    setIsLoadingTerminals(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("terminals")
        .select("*")
        .eq("merchant_id", resolvedMerchantId)
        .order("last_active", { ascending: false });

      if (error) {
        throw error;
      }

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        label: row.terminal_label ?? "Fleet Terminal",
        status: row.status === "online" ? "online" : "offline",
        lastSeen: row.last_active ? new Date(row.last_active).getTime() : Date.now(),
        accessCode: normalizePairingCode(row.device_token ?? "") || createAccessCode(),
        isActive: row.status === "online",
        lastLoginAt: row.last_active ? new Date(row.last_active).getTime() : null,
      }));

      setTerminals?.(mapped);
      if (mapped.length > 0 && !authCode) {
        setAuthCode(mapped[0].accessCode ?? createAccessCode());
      }
    } catch (error) {
      console.error("Failed to load terminals from Supabase", error);
    } finally {
      setIsLoadingTerminals(false);
    }
  };

  const persistTerminals = async (updated: Terminal[]) => {
    setTerminals?.(updated);

    const merchantIdToUse = resolvedMerchantId;
    if (!merchantIdToUse) {
      throw new Error("Cannot persist terminals: merchant identity unavailable.");
    }

    try {
      const supabase = createSupabaseBrowserClient();
      await Promise.all(
        updated.map(async (terminal) => {
          const payload = {
            id: terminal.id,
            merchant_id: merchantIdToUse,
            terminal_label: terminal.label,
            device_token: normalizePairingCode(terminal.accessCode ?? "") || createAccessCode(),
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
    let cancelled = false;

    const initMerchantId = async () => {
      const storedMerchantId = getStoredMerchantId();
      if (storedMerchantId) {
        if (!cancelled) setResolvedMerchantId(storedMerchantId);
      }

      const id = await resolveMerchantId();
      if (!cancelled) {
        setResolvedMerchantId(id);
      }
    };

    void initMerchantId();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadFromSupabase();
  }, [resolvedMerchantId]);

  useEffect(() => {
    if (!resolvedMerchantId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (fleetChannelRef.current) {
      void supabase.removeChannel(fleetChannelRef.current);
      fleetChannelRef.current = null;
    }

    const channel = supabase
      .channel(`fleet:${resolvedMerchantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "terminals", filter: `merchant_id=eq.${resolvedMerchantId}` },
        () => {
          void loadFromSupabase();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "terminals", filter: `merchant_id=eq.${resolvedMerchantId}` },
        () => {
          void loadFromSupabase();
        }
      )
      .subscribe();

    fleetChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      fleetChannelRef.current = null;
    };
  }, [resolvedMerchantId]);

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
    setTimeLeft("10M 00S");
  };

  const pairNewTerminal = async () => {
    const defaultLabel = createDefaultTerminalLabel();
    setNewTerminalLabel(defaultLabel);
    setAuthCode("");
    setPairingState("waiting");
    setPairingExpiresAt(null);
    setTimeLeft("10M 00S");
    setIsPairingOpen(true);
    await refreshAuthCode(defaultLabel);
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

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              void pairNewTerminal();
            }}
            disabled={isRefreshingCode}
            className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-black transition-all hover:bg-zinc-200 disabled:opacity-60"
          >
            <LucidePlus size={14} /> {isRefreshingCode ? "Generating..." : "Pair New"}
          </button>
        </div>
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
        onClose={closePairingModal}
        authCode={authCode}
        onRefresh={() => {
          void refreshAuthCode();
        }}
        timeLeft={timeLeft}
        terminalName={newTerminalLabel}
        onTerminalNameChange={(v) => setNewTerminalLabel(v)}
        pairingState={pairingState}
      />
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 px-6 py-3 rounded-full text-[10px] font-bold uppercase">
          {toast}
        </div>
      )}
    </div>
  );
}
