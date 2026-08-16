export async function setupConfidentialAccount(merchantPublicKey: string, params?: any) {
  const res = await fetch("/api/relayer/setup-confidential", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantPublicKey,
      params: params || {},
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to setup confidential account");
  }
  return data;
}