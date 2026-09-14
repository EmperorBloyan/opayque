type SecurityEvent = "wallet" | "api_key";

export async function notifyMerchantSecurityEvent(
  merchant: { email?: string | null; secondary_email?: string | null; merchant_name?: string | null },
  event: SecurityEvent,
  details: string
) {
  const recipients = Array.from(new Set([merchant.email, merchant.secondary_email]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean)));
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!recipients.length || !apiKey || !fromEmail) return;

  const label = event === "wallet" ? "Wallet change" : "API key change";
  await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{
        to: recipients.map((email) => ({ email })),
        subject: `${label} for ${merchant.merchant_name ?? "your merchant account"}`,
      }],
      from: { email: fromEmail },
      content: [{ type: "text/plain", value: `${label} detected. ${details} If you did not make this change, sign in and secure your account immediately.` }],
    }),
  });
}
