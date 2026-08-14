"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface EnvironmentContextType {
  isSandbox: boolean;
  network: "devnet" | "mainnet-beta";
  rpcEndpoint: string;
  toggleEnvironment: () => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [isSandbox, setIsSandbox] = useState<boolean>(true);

  // Load saved environment on startup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEnv = localStorage.getItem("opayque_env");
      if (savedEnv) {
        setIsSandbox(savedEnv === "sandbox");
      }
    }
  }, []);

  const toggleEnvironment = () => {
    setIsSandbox((prev) => {
      const nextState = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("opayque_env", nextState ? "sandbox" : "production");
        // Dispatch custom event so non-react listeners update instantly
        window.dispatchEvent(new Event("environment_changed"));
      }
      return nextState;
    });
  };

  const network = isSandbox ? "devnet" : "mainnet-beta";
  const rpcEndpoint = isSandbox
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

  return (
    <EnvironmentContext.Provider
      value={{
        isSandbox,
        network,
        rpcEndpoint,
        toggleEnvironment,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  
  if (!context) {
    return {
      isSandbox: true,
      network: "devnet" as const,
      rpcEndpoint: "https://api.devnet.solana.com",
      toggleEnvironment: () => {
        console.warn("[EnvironmentContext] Called outside EnvironmentProvider wrap!");
      },
    };
  }
  
  return context;
}
