import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

const PROGRAM_ID = new PublicKey("5K1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmGp");
const OPAYQUE_IDL: Idl = {
  version: '0.1.0',
  name: 'opayque',
  instructions: [],
  accounts: [],
  types: [],
  metadata: { address: PROGRAM_ID.toBase58() },
} as Idl;

export function useOpayqueProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    return new Program(OPAYQUE_IDL, PROGRAM_ID, provider);
  }, [connection, wallet]);

  return { program };
}
