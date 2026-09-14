import { createClient } from "@/lib/supabase/client";

export async function reauthenticateForSensitiveAction() {
  const password = window.prompt("Enter your password to confirm this sensitive change.");
  if (!password) throw new Error("Password confirmation is required.");

  const response = await fetch("/api/auth/reauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Password confirmation failed.");

  await createClient().auth.getSession();
}
