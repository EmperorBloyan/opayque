import { ComputeBudgetProgram, type TransactionInstruction } from "@solana/web3.js";

const DEFAULT_COMPUTE_UNIT_LIMIT = 300_000;
const DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 1_000;

export function getPriorityFeeConfig() {
  const computeUnitLimit = Number(process.env.SOLANA_COMPUTE_UNIT_LIMIT ?? DEFAULT_COMPUTE_UNIT_LIMIT);
  const microLamports = Number(process.env.SOLANA_PRIORITY_FEE_MICROLAMPORTS ?? DEFAULT_PRIORITY_FEE_MICROLAMPORTS);
  return {
    computeUnitLimit: Number.isInteger(computeUnitLimit) && computeUnitLimit > 0 && computeUnitLimit <= 1_400_000 ? computeUnitLimit : DEFAULT_COMPUTE_UNIT_LIMIT,
    microLamports: Number.isInteger(microLamports) && microLamports >= 0 && microLamports <= 10_000_000 ? microLamports : DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
  };
}

export function getComputeBudgetInstructions(): TransactionInstruction[] {
  const config = getPriorityFeeConfig();
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: config.computeUnitLimit }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: config.microLamports }),
  ];
}