import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

/**
 * This verifies an Ed25519 signature only. It does not verify Intel TDX,
 * MagicBlock, or any hardware attestation.
 */
export const verifyEd25519Signature = async (
  payload: string,
  signature: Uint8Array,
  teePublicKey: PublicKey
): Promise<boolean> => {
  const message = new TextEncoder().encode(payload);
  
  const isValid = nacl.sign.detached.verify(
    message,
    signature,
    teePublicKey.toBytes()
  );

  if (!isValid) throw new Error("Ed25519 signature mismatch");
  return true;
};