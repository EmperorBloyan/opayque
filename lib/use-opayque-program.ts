import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import idl from '../anchor/target/idl/opayque.json';

const PROGRAM_ID = new PublicKey("5K1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmGp");

export function useOpayqueProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    return new Program(idl as any, PROGRAM_ID, provider);
  }, [connection, wallet]);

  return { program };
}
