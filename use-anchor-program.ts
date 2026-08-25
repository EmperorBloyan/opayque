'use client';

import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import OPAYQUE_IDL_JSON from '@/lib/idl/opayque.json';

const OPAYQUE_IDL = OPAYQUE_IDL_JSON as unknown as Idl;
const PROGRAM_ID = new PublicKey(OPAYQUE_IDL_JSON.address);

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

    return new Program(OPAYQUE_IDL, PROGRAM_ID, provider);
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