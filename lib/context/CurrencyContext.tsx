"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type RatesMap = Record<string, number>;

type CurrencyContextValue = {
  currency: string;
  setCurrency: (code: string) => void;
  rates: RatesMap;
  loading: boolean;
  isLoadingRates: boolean;
  error: string | null;
  asOf: string | null;
  source: string;
  stale: boolean;
  convert: (usdAmount: number) => { value: number; formatted: string };
  toUsdc: (fiatAmount: number, fromCurrency?: string) => number;
  refreshRates: () => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const FALLBACK_RATES: RatesMap = {
  USD: 1,
  USDC: 1,
  EUR: 0.92,
  GBP: 0.78,
  NGN: 1600,
  GHS: 15.5,
  KES: 129,
  ZAR: 18.2,
  INR: 83,
  CAD: 1.36,
  AUD: 1.52,
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState("USD");
  const [rates, setRates] = useState<RatesMap>(FALLBACK_RATES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [source, setSource] = useState("fallback");
  const [stale, setStale] = useState(true);

  const setCurrency = useCallback((code: string) => {
    const next = (code || "USD").toUpperCase();
    setCurrencyState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("merchant_preferred_currency", next);
    }
  }, []);

  const refreshRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Prefer your own API if it exists
      let res = await fetch("/api/v1/rates", { cache: "no-store" });
      
      if (!res.ok) throw new Error(`Rate provider failed (${res.status})`);

      const data = await res.json();
      const incoming = (data.rates || data) as RatesMap;

      setRates({
        USD: 1,
        USDC: 1,
        ...incoming,
        NGN: Number(incoming.NGN) > 0 ? Number(incoming.NGN) : FALLBACK_RATES.NGN,
        GHS: Number(incoming.GHS) > 0 ? Number(incoming.GHS) : FALLBACK_RATES.GHS,
        KES: Number(incoming.KES) > 0 ? Number(incoming.KES) : FALLBACK_RATES.KES,
      });
      setAsOf(typeof data.asOf === "string" ? data.asOf : new Date().toISOString());
      setSource(typeof data.source === "string" ? data.source : "provider");
      setStale(Boolean(data.stale));
      if (data.stale) setError("Approximate or stale rates");
    } catch (err: any) {
      console.warn("FX rate fetch failed, using fallback", err);
      setError(err?.message || "Failed to fetch rates");
      setRates((prev) => ({ ...FALLBACK_RATES, ...prev }));
      setSource("fallback");
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("merchant_preferred_currency");
    if (saved) setCurrencyState(saved.toUpperCase());
    void refreshRates();
  }, [refreshRates]);

  // Display only (USD → local)
  const convert = useCallback(
    (usdAmount: number) => {
      const amount = Number(usdAmount) || 0;
      const rate = Number(rates[currency] ?? 1) || 1;
      const local = amount * rate;
      return {
        value: local,
        formatted: `${local.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ${currency}`,
      };
    },
    [currency, rates]
  );

  // Settlement only (local fiat → USDC)
  const toUsdc = useCallback(
    (fiatAmount: number, fromCurrency?: string) => {
      const amount = Number(fiatAmount) || 0;
      const code = (fromCurrency || currency || "USD").toUpperCase();

      if (code === "USD" || code === "USDC") return amount;

      const rate = Number(rates[code] ?? 0);
      if (!rate || rate <= 0) return Number.NaN;

      return Math.round((amount / rate) * 1_000_000) / 1_000_000;
    },
    [currency, rates]
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      loading,
      isLoadingRates: loading,
      error,
      asOf,
      source,
      stale,
      convert,
      toUsdc,
      refreshRates,
    }),
    [currency, setCurrency, rates, loading, error, convert, toUsdc, refreshRates]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}