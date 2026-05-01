import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';

// ✅ PROFESSIONAL METADATA (What shows in the browser tab)
export const metadata = {
  title: 'Opayque | Shielded Merchant Infrastructure',
  description: 'Enterprise-grade privacy and terminal management for the Solana ecosystem.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className={`${inter.className} antialiased selection:bg-purple-500/30`}>
        {/* NOTE: If you have a WalletProvider component, wrap {children} here.
            For now, this ensures the black background and professional font 
            are consistent across your Admin and Terminal pages.
        */}
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
