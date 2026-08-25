import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requireTerminalDevice(request: Request, terminalId: string) {
  const token = request.headers.get("x-terminal-token")?.trim();
  if (!token || !terminalId) return { error: "Terminal authentication required", status: 401 as const };

  const supabase = createSupabaseServerClient(request);
  const { data: terminal, error } = await supabase
    .from("terminals")
    .select("id, merchant_id, status")
    .eq("id", terminalId)
    .eq("device_token_hash", hashDeviceToken(token))
    .maybeSingle();

  if (error || !terminal || terminal.status === "revoked") {
    return { error: "Terminal authentication failed", status: 401 as const };
  }

  return { terminal, supabase };
}
