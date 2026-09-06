const MERCHANT_PROFILE_KEYS = [
  "merchant_name",
  "merchant_logo",
  "merchant_avatar",
  "merchant_email",
  "email",
  "secondary_email",
  "website_url",
  "webhook_url",
  "settlement_wallet_address",
  "merchant_api_access_status",
];

export function clearMerchantProfileCache(): void {
  if (typeof window === "undefined") return;
  for (const key of MERCHANT_PROFILE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
