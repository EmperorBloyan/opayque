import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function matchesTerminalDeviceToken(
  terminal: { device_token_hash?: string | null } | null | undefined,
  token: string,
): boolean {
  if (!terminal || !token) return false;

  const normalizedToken = token.trim();
  if (!normalizedToken) return false;

  const hashedValue = hashDeviceToken(normalizedToken);
  if (terminal.device_token_hash && terminal.device_token_hash === hashedValue) {
    return true;
  }

  return false;
}

export async function requireTerminalDevice(request: Request, terminalId: string) {
  const token = request.headers.get("x-terminal-token")?.trim();
  if (!token || token.length > 512 || !terminalId) return { error: "Terminal authentication required", status: 401 as const };

  const supabase = createSupabaseServerClient();

  let terminal: { id: string; merchant_id: string; status: string; device_token_hash?: string | null } | null = null;

  try {
    const { data, error } = await supabase
      .from("terminals")
      .select("id, merchant_id, status, device_token_hash")
      .eq("id", terminalId)
      .maybeSingle();

    if (error) {
      console.warn("Terminal token lookup failed", error);
    } else {
      terminal = data;
    }
  } catch (error) {
    console.warn("Terminal lookup failed", error);
  }

  if (!terminal || !matchesTerminalDeviceToken(terminal, token) || ["revoked", "unpaired", "deleted"].includes(String(terminal.status).toLowerCase())) {
    return { error: "Terminal authentication failed", status: 401 as const };
  }

  return { terminal, supabase };
}
