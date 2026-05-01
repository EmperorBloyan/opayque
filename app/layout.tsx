import "./globals.css"; // Fixed: ensure this is in the same folder (app/)
import { Inter } from "next/font/google";
import React from "react";
// Go UP one level out of 'app' to find the 'components' folder at root
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
        {/* Wrapping with the Provider from the components folder */}
        <WalletProviderWrapper>
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
