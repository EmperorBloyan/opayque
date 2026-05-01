import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import WalletProviderWrapper from "../components/WalletProvider";

export const metadata = {
  title: "Opayque | Shielded Merchant Infrastructure",
  description: "Enterprise-grade privacy and terminal management for the Solana ecosystem.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased selection:bg-purple-500/30`}>
        <WalletProviderWrapper>
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
