export function normalizePairingCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchesPairingCode(input, storedValue) {
  return normalizePairingCode(input) === normalizePairingCode(storedValue ?? "");
}
