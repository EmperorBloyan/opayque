import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import AppWalletProvider from "./AppWalletProvider";

// Professional Metadata for the browser tab
export const metadata = {
  title: "Opayque | Shielded Merchant Infrastructure",
  description: "Enterprise-grade privacy and terminal management for the Solana ecosystem.",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black antialiased`}>
        {/* This wraps the entire app in the Solana context */}
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}
