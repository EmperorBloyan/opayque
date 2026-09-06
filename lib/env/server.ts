export interface OfframpConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret?: string;
}

export function getOfframpConfig(): { config?: OfframpConfig; error?: string } {
  const apiUrl = process.env.BRIDGE_API_URL?.trim() || "https://api.bridge.xyz/v0";
  const apiKey = process.env.BRIDGE_API_KEY?.trim();
  const webhookSecret = process.env.BRIDGE_WEBHOOK_SECRET?.trim();

  if (!apiUrl || !apiKey) {
    return { error: "External fiat payout partner is not configured" };
  }

  return { config: { apiUrl, apiKey, webhookSecret } };
}

export function getStaffTerminalPin(): string | null {
  const pin = process.env.STAFF_TERMINAL_PIN;
  return pin?.trim().toUpperCase() || null;
}
