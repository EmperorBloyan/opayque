export function normalizePairingCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchesPairingCode(input: string, storedValue: string | null | undefined) {
  return normalizePairingCode(input) === normalizePairingCode(storedValue ?? "");
}
