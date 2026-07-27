import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';

const PROGRAM_ID = new PublicKey("5K1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmGp");
const FALLBACK_IDL: Idl = {
  version: '0.1.0',
  name: 'opayque',
  instructions: [],
  accounts: [],
  types: [],
  metadata: { address: PROGRAM_ID.toBase58() },
} as Idl;

export const useAnchorProgram = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    return new Program(FALLBACK_IDL, PROGRAM_ID, provider);
  }, [connection, wallet]);

  const getValidSolanaPayUri = (amount: number) => {
    if (typeof window === 'undefined') {
      return `solana:11111111111111111111111111111111?amount=${amount}`;
    }

    const apiEndpoint = encodeURIComponent(`${window.location.origin}/api/pay?amount=${amount}`);
    return `solana:${apiEndpoint}`;
  };

  return { program, getValidSolanaPayUri };
};