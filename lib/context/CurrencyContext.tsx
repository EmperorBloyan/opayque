"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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
    // 1. Load saved preferred currency from local storage
    const savedCurrency = window.localStorage.getItem("merchant_preferred_currency");
    if (savedCurrency) {
      setCurrencyState(savedCurrency);
    }

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
    window.localStorage.setItem("merchant_preferred_currency", curr);
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
