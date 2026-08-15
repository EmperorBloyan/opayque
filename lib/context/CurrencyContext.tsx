"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface CurrencyContextType {
  currency: string;
  setCurrency: (curr: string) => void;
  rates: Record<string, number>;
  convert: (amountInUsdc: number) => { formatted: string; raw: number };
  isLoadingRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>("USD");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [isLoadingRates, setIsLoadingRates] = useState<boolean>(true);

  useEffect(() => {
    const initCurrency = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Try to fetch merchant's preferred currency from Supabase
          const { data: merchant, error } = await supabase
            .from("merchants")
            .select("preferred_currency")
            .eq("auth_user_id", user.id)
            .single();
          
          if (!error && merchant?.preferred_currency) {
            setCurrencyState(merchant.preferred_currency);
          } else {
            // Fallback to localStorage
            const savedCurrency = window.localStorage.getItem("merchant_preferred_currency");
            if (savedCurrency) {
              setCurrencyState(savedCurrency);
            }
          }
        } else {
          // User not authenticated - use localStorage
          const savedCurrency = window.localStorage.getItem("merchant_preferred_currency");
          if (savedCurrency) {
            setCurrencyState(savedCurrency);
          }
        }
      } catch (err) {
        console.warn("Failed to load currency preference from Supabase, using localStorage", err);
        const savedCurrency = window.localStorage.getItem("merchant_preferred_currency");
        if (savedCurrency) {
          setCurrencyState(savedCurrency);
        }
      }
    };

    // 1. Load currency preference
    void initCurrency();

    // 2. Fetch live fiat rates
    const fetchRates = async () => {
      try {
        const res = await fetch("/api/v1/rates");
        const data = await res.json();
        if (data.success && data.rates) {
          setRates(data.rates);
        }
      } catch (err) {
        console.warn("Failed to load exchange rates, defaulting to USD", err);
      } finally {
        setIsLoadingRates(false);
      }
    };

    fetchRates();
  }, []);

  const setCurrency = (curr: string) => {
    setCurrencyState(curr);
    
    // Save to localStorage always
    if (typeof window !== "undefined") {
      window.localStorage.setItem("merchant_preferred_currency", curr);
    }

    // Save to Supabase if user is authenticated
    const saveToDB = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          await supabase
            .from("merchants")
            .update({ preferred_currency: curr })
            .eq("auth_user_id", user.id);
        }
      } catch (err) {
        console.warn("Failed to save currency preference to Supabase", err);
      }
    };

    void saveToDB();
  };

  const convert = (amountInUsdc: number) => {
    const rate = rates[currency] || 1;
    const convertedAmount = amountInUsdc * rate;
    
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);

    return {
      formatted,
      raw: convertedAmount,
    };
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rates, convert, isLoadingRates }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
