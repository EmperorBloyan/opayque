export const TRANSFER_MODES = ["private", "public"] as const;

export type TransferMode = (typeof TRANSFER_MODES)[number];

export function normalizeTransferMode(value: unknown): TransferMode {
  return value === "public" ? "public" : "private";
}

export function isTransferMode(value: unknown): value is TransferMode {
  return value === "private" || value === "public";
}