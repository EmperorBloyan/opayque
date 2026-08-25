'use client';

import { Program, AnchorProvider, type Idl } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import OPAYQUE_IDL_JSON from '@/lib/idl/opayque.json';

const OPAYQUE_IDL = OPAYQUE_IDL_JSON as unknown as Idl;
const PROGRAM_ID = new PublicKey(OPAYQUE_IDL_JSON.address);

export function useOpayqueProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    return new Program(OPAYQUE_IDL, provider);
  }, [connection, wallet]);

  return { program };
}
