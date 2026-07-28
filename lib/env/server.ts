export interface OfframpConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret?: string;
}

export function getOfframpConfig(): { config?: OfframpConfig; error?: string } {
  const apiUrl = process.env.FIAT_OFFRAMP_API_URL_PROD?.trim();
  const apiKey = process.env.FIAT_OFFRAMP_API_KEY_PROD?.trim();
  const webhookSecret = process.env.FIAT_OFFRAMP_WEBHOOK_SECRET_PROD?.trim();

  if (!apiUrl || !apiKey) {
    return { error: 'Production off-ramp not configured: FIAT_OFFRAMP_API_URL_PROD or FIAT_OFFRAMP_API_KEY_PROD is missing' };
  }

  return { config: { apiUrl, apiKey, webhookSecret } };
}

export function getStaffTerminalPin(): string | null {
  const pin = process.env.NEXT_PUBLIC_STAFF_TERMINAL_PIN;
  if (!pin) return null;
  return pin.trim().toUpperCase();
}
