import { PublicKey } from '@solana/web3.js';
import * as nacl from 'tweetnacl';

/**
 * In a deep on-chain solution, the TEE signs an attestation of the external event.
 * This client-side helper prepares the data for the Anchor program.
 */
export const verifyTeePayload = async (
  payload: string, 
  signature: Uint8Array, 
  teePublicKey: PublicKey
) => {
  const message = new TextEncoder().encode(payload);
  
  // Local check before sending to chain
  const isValid = nacl.sign.detached.verify(
    message,
    signature,
    teePublicKey.toBytes()
  );

  if (!isValid) throw new Error("TEE Signature Mismatch");
  return true;
};