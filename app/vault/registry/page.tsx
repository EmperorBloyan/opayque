"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EndpointRegistry from "@/components/EndpointRegistry";
import TerminalManager from "@/components/TerminalManager";
import ReportingHub from "@/components/ReportingHub";
import { Endpoint, Terminal } from "@/lib/types";
import {
  LucideLock,
  LucideFileSpreadsheet,
  LucideTrash2,
  LucideQrCode,
  LucideShieldCheck,
  LucideX,
  LucidePrinter,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  bindAuthenticatedMerchantSession,
  clearActiveSession,
  getActiveMerchantId,
} from "@/lib/crypto/session";

export default function RegistryPage() {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [isReportHubOpen, setIsReportHubOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [vaultReady, setVaultReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [resolvedMerchantId, setResolvedMerchantId] = useState<string | null>(null);

  const goToDestination = (path: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(path);
    setTimeout(() => setIsNavigating(false), 1000);
  };

  const resolveMerchantId = useCallback(async (): Promise<string | null> => {
    let merchantId = getActiveMerchantId();

    if (!merchantId || merchantId === "merchant-vault") {
      try {
        const res = await fetch("/api/v1/merchant", { credentials: "include" });
        if (res.ok) {
          const payload = await res.json();
          const merchant = payload?.merchant;
          if (merchant?.id) {
            merchantId = merchant.id;
            bindAuthenticatedMerchantSession({
              merchantId: merchant.id,
              walletAddress: merchant.settlement_wallet_address || null,
            });

            if (typeof window !== "undefined") {
              if (merchant.merchant_name) {
                window.localStorage.setItem("merchant_name", merchant.merchant_name);
              }
              if (merchant.merchant_logo) {
                window.localStorage.setItem("merchant_logo", merchant.merchant_logo);
              }
              if (merchant.settlement_wallet_address) {
                window.localStorage.setItem(
                  "settlement_wallet_address",
                  merchant.settlement_wallet_address
                );
              }
            }
          }
        }
      } catch (error) {
        console.warn("Failed to fetch merchant context", error);
      }
    }

    if (!merchantId || merchantId === "merchant-vault") return null;
    return merchantId;
  }, []);

  const loadTerminalData = useCallback(async (merchantId?: string | null) => {
    try {
      const id = merchantId || (await resolveMerchantId());
      if (!id) {
        setTerminals([]);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("terminals")
        .select("*")
        .eq("merchant_id", id)
        .order("last_active", { ascending: false });

      if (error) throw error;

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        label: row.terminal_label ?? "Fleet Terminal",
        status: (row.status === "online" ? "online" : "offline") as "online" | "offline",
        lastSeen: row.last_active ? new Date(row.last_active).getTime() : Date.now(),
        accessCode: row.device_token ?? "",
        isActive: row.status === "online",
        lastLoginAt: row.last_active ? new Date(row.last_active).getTime() : null,
      }));

      setTerminals(mapped);
    } catch (error) {
      console.error("Failed to hydrate registry terminals", error);
      setTerminals([]);
    }
  }, [resolveMerchantId]);

  const loadEndpointData = useCallback(() => {
    if (typeof window === "undefined") return;
    const storedEndpoints = window.localStorage.getItem("opayque_endpoints");
    if (!storedEndpoints) return;

    try {
      const parsed = JSON.parse(storedEndpoints) as Endpoint[];
      setEndpoints(parsed);
    } catch (error) {
      console.warn("Failed to parse stored endpoints", error);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);

    const boot = async () => {
      try {
        const merchantId = await resolveMerchantId();

        if (!merchantId) {
          clearActiveSession();
          if (typeof window !== "undefined") {
            window.localStorage.setItem("opayque_next_route", "/vault/registry");
          }
          router.replace("/login?next=%2Fvault%2Fregistry");
          return;
        }

        setResolvedMerchantId(merchantId);
        setVaultReady(true);
        loadEndpointData();
        await loadTerminalData(merchantId);
      } catch (error) {
        console.error("Vault registry boot failed", error);
        setVaultReady(false);
      } finally {
        // CRITICAL: this was missing and caused infinite "Checking merchant access..."
        setIsInitializing(false);
      }
    };

    void boot();
  }, [loadEndpointData, loadTerminalData, resolveMerchantId, router]);

  // Refresh fleet when page becomes visible again / after pairing flows
  useEffect(() => {
    if (!vaultReady || !resolvedMerchantId) return;

    const refresh = () => {
      void loadTerminalData(resolvedMerchantId);
    };

    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === "opayque_terminals" ||
        e.key === "opayque_terminal_id" ||
        e.key === ACTIVE_DUMMY_KEY
      ) {
        refresh();
      }
    };
    const onCustom = () => refresh();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("opayque_terminals_updated", onCustom as EventListener);

    // light polling while registry is open (helps after pair)
    const interval = window.setInterval(refresh, 8000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("opayque_terminals_updated", onCustom as EventListener);
      window.clearInterval(interval);
    };
  }, [vaultReady, resolvedMerchantId, loadTerminalData]);

  const persistEndpoints = (updated: Endpoint[]) => {
    setEndpoints(updated);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("opayque_endpoints", JSON.stringify(updated));
    }
  };

  const handleSaveEndpoint = (newEndpoint: Endpoint) => {
    const updated = [newEndpoint, ...endpoints];
    persistEndpoints(updated);
  };

  const handleDeleteEndpoint = (id: string) => {
    const updated = endpoints.filter((e) => e.id !== id);
    persistEndpoints(updated);
    if (selectedEndpoint?.id === id) setSelectedEndpoint(null);
  };

  if (isInitializing || !vaultReady) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
            Vault Authorization Required
          </p>
          <h2 className="mt-4 text-2xl font-black">Checking merchant access...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20 animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12 px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem("opayque_next_route", "/vault/registry");
              }
              goToDestination("/login?next=%2Fvault%2Fregistry");
            }}
            disabled={isNavigating}
            className="group flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-purple-400 transition-all disabled:opacity-50"
          >
            <LucideLock size={14} className="group-hover:animate-pulse" /> Lock Vault
          </button>
        </div>

        <div className="flex items-center gap-2">
          <LucideShieldCheck size={16} className="text-purple-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
            TEE Session Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 ml-4">
              Identity Registration
            </h2>
            <EndpointRegistry onSave={handleSaveEndpoint} existingEndpoints={endpoints} />
          </section>

          <section>
            <div className="mb-6 ml-4 flex items-center justify-between pr-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                Hardware Fleet
              </h2>
              <button
                type="button"
                onClick={() => void loadTerminalData(resolvedMerchantId)}
                className="text-[9px] font-black uppercase tracking-[0.2em] text-purple-400 hover:text-purple-300"
              >
                Refresh
              </button>
            </div>
            <TerminalManager
              terminals={terminals}
              setTerminals={setTerminals}
              showHeaderInput={false}
            />
          </section>
        </div>

        <div className="lg:col-span-8">
          <section className="bg-zinc-900/20 border border-white/5 rounded-[3.5rem] p-10 min-h-[700px] shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">
                  Universal Registry
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">
                  Verified Recipient Database
                </p>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-xl">
                <span className="text-[10px] font-black text-purple-500 uppercase">
                  {endpoints.length} Registered
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="group bg-black/40 border border-white/5 p-6 rounded-[2.5rem] hover:border-purple-500/30 transition-all duration-500"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl font-bold italic overflow-hidden border border-white/5">
                      {ep.image ? (
                        <img src={ep.image} className="w-full h-full object-cover" alt="" />
                      ) : (
                        ep.name[0]
                      )}
                    </div>
                    <div>
                      <p className="font-black uppercase text-sm tracking-tight text-white">
                        {ep.name}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-600 truncate w-32">
                        {ep.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedEndpoint(ep)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-600 transition-all"
                    >
                      <LucideQrCode size={14} /> Identity Tag
                    </button>
                    <button
                      onClick={() => handleDeleteEndpoint(ep.id)}
                      className="p-3 bg-zinc-900 text-zinc-700 hover:text-red-500 rounded-xl transition-all"
                    >
                      <LucideTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {endpoints.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-800">
                <LucideShieldCheck size={40} className="mb-4 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Vault Empty</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <button
        onClick={() => setIsReportHubOpen(true)}
        className="fixed bottom-10 right-10 z-40 w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-110 active:scale-95 transition-all group"
      >
        <LucideFileSpreadsheet size={24} className="group-hover:rotate-12 transition-transform" />
        <span className="absolute right-20 bg-zinc-900 border border-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          Compliance Center
        </span>
      </button>

      {selectedEndpoint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 p-12 rounded-[4rem] max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setSelectedEndpoint(null)}
              className="absolute top-8 right-8 text-zinc-500 hover:text-white"
            >
              <LucideX size={24} />
            </button>
            <h3 className="text-2xl font-black italic uppercase mb-2 text-white">
              {selectedEndpoint.name}
            </h3>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-10">
              Opayque Protected Endpoint
            </p>

            <div className="relative p-8 bg-white rounded-[3rem] mb-10 inline-block">
              {isMounted && typeof window !== "undefined" ? (
                <>
                  <QRCodeSVG
                    value={`${window.location.origin}/vault/checkout?address=${encodeURIComponent(
                      selectedEndpoint.address
                    )}&name=${encodeURIComponent(selectedEndpoint.name)}&category=${encodeURIComponent(
                      selectedEndpoint.category || "Registry"
                    )}`}
                    size={200}
                    level="H"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border-4 border-white shadow-xl">
                      <span className="text-white text-lg font-black italic">O</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-[200px] h-[200px] rounded-[2rem] border border-zinc-200 bg-zinc-100" />
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <LucidePrinter size={16} /> Print Identity Tag
            </button>
          </div>
        </div>
      )}

      <ReportingHub isOpen={isReportHubOpen} onClose={() => setIsReportHubOpen(false)} />
    </div>
  );
}

// local helper constant used only for storage listener guard
const ACTIVE_DUMMY_KEY = "opayque_terminal_token";