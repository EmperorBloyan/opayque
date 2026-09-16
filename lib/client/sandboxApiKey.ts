const SANDBOX_API_KEY_STORAGE_KEY = "opayque_sandbox_api_key";

export function readSandboxApiKey(): string {
  if (typeof window === "undefined") return "";

  try {
    const value = window.localStorage.getItem(SANDBOX_API_KEY_STORAGE_KEY)?.trim() ?? "";
    return value.startsWith("osk_test_") ? value : "";
  } catch {
    return "";
  }
}

export function writeSandboxApiKey(secret: string | null | undefined): void {
  if (typeof window === "undefined") return;

  const normalized = typeof secret === "string" ? secret.trim() : "";
  if (!normalized || !normalized.startsWith("osk_test_")) {
    return;
  }

  try {
    window.localStorage.setItem(SANDBOX_API_KEY_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures; the user can re-create the key.
  }
}

export function clearSandboxApiKey(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SANDBOX_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
