export function parseAmountToBaseUnits(value: unknown, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const text = typeof value === "number" && Number.isFinite(value) ? value.toString() : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  const baseUnits = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0") || "0");
  return baseUnits > 0n ? baseUnits : null;
}
