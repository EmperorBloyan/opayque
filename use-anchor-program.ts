import { useMemo } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
// This assumes you've run 'anchor build' and have the IDL
import idl from '@anchor/target/idl/connecting_anchor.json';

const PROGRAM_ID = new PublicKey("YOUR_ACTUAL_PROGRAM_ID_HERE");

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

    return new Program(idl as Idl, PROGRAM_ID, provider);
  }, [connection, wallet]);

  const getValidSolanaPayUri = (amount: number) => {
    // Correct format for a Transaction Request
    const apiEndpoint = encodeURIComponent(`${window.location.origin}/api/pay?amount=${amount}`);
    return `solana:${apiEndpoint}`;
  };

  return { program, getValidSolanaPayUri };
};