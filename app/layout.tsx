import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Fixed CSS import for Turbopack compatibility
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletProvider } from "@/components/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Opayque | Shielded Checkout",
  description: "Private merchant payments on Solana using MagicBlock Private Ephemeral Rollups",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <WalletProvider>
          <div className="relative min-h-screen flex flex-col">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-purple-900/10 blur-[120px] pointer-events-none" />
            <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <span className="text-xl font-bold tracking-tighter text-white">
                  OPAYQUE<span className="text-purple-500">.</span>
                </span>
              </div>
            </nav>
            <main className="flex-grow relative z-10">
              {children}
            </main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}