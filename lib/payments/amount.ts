export function parseAmountToBaseUnits(value: unknown, decimals: number): bigint | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;

  const text = typeof value === "number"
    ? Number.isFinite(value) && !Number.isNaN(value) ? value.toString() : ""
    : typeof value === "string"
      ? value.trim()
      : "";

  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  if (text.includes("e") || text.includes("E")) return null;

  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;

  const normalizedWhole = whole === "" ? "0" : whole;
  const baseUnits = BigInt(normalizedWhole) * (10n ** BigInt(decimals)) + BigInt(fraction.padEnd(decimals, "0") || "0");
  return baseUnits > 0n ? baseUnits : null;
}
