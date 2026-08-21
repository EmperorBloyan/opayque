"use client";

import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-800/30" />
    ),
  }
);

interface WalletConnectPanelProps {
  className?: string;
}

export default function WalletConnectPanel({
  className = "",
}: WalletConnectPanelProps) {
  return (
    <div className="w-full">
      <WalletMultiButton className={className} />
      <p className="mt-2 text-center text-[10px] text-zinc-500 md:hidden">
        If connection fails, open this site in the Phantom in-app browser.
      </p>
    </div>
  );
}
