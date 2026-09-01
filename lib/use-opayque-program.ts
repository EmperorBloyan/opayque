'use client';

import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import OPAYQUE_IDL_JSON from '@/lib/idl/opayque.json';

type OpayqueIdl = typeof OPAYQUE_IDL_JSON;
const OPAYQUE_IDL = OPAYQUE_IDL_JSON as OpayqueIdl;
export const OPAYQUE_PROGRAM_ID = new PublicKey(OPAYQUE_IDL.address);

export function useOpayqueProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    return new Program<OpayqueIdl>(OPAYQUE_IDL, provider);
  }, [connection, wallet]);

  return { program };
}
