import "./globals.css"; // Ensure lowercase 'i'
import { Inter } from "next/font/google";
import React from "react";
import AppWalletProvider from "./components/AppWalletProvider";

// Professional Metadata for the Solana Radar Hackathon
export const metadata = {
  title: "Opayque | Shielded Merchant Infrastructure",
  description: "Enterprise-grade privacy and terminal management for the Solana ecosystem.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  icons: {
    icon: "/favicon.ico", // Ensure you have a favicon in /public
  },
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased selection:bg-purple-500/30`}>
        {/* The Provider is placed here to ensure the Wallet Context 
          is available from the Landing Page all the way to the Terminal.
        */}
        <AppWalletProvider>
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}
