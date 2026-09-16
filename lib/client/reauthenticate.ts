import { createClient } from "@/lib/supabase/client";

export interface SensitivePasswordRequest {
  resolve: (password: string) => void;
  reject: (error: Error) => void;
}

function requestPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    window.dispatchEvent(new CustomEvent<SensitivePasswordRequest>("opayque:reauth-request", {
      detail: { resolve, reject },
    }));
  });
}

export async function reauthenticateForSensitiveAction() {
  const password = await requestPassword();

  const response = await fetch("/api/auth/reauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Password confirmation failed.");

  await createClient().auth.getSession();
}
