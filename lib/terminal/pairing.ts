export function normalizePairingCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatPairingCountdown(expiresAt: number | null, fallback = "10M 00S") {
  if (!expiresAt) return fallback;

  const remaining = Math.max(0, expiresAt - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  return `${String(mins).padStart(2, "0")}M ${String(secs).padStart(2, "0")}S`;
}

export function matchesPairingCode(input: string, storedValue: string | null | undefined) {
  return normalizePairingCode(input) === normalizePairingCode(storedValue ?? "");
}
