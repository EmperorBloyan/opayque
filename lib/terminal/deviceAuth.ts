import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function matchesTerminalDeviceToken(
  terminal: { device_token_hash?: string | null; device_token?: string | null } | null | undefined,
  token: string,
): boolean {
  if (!terminal || !token) return false;

  const normalizedToken = token.trim();
  if (!normalizedToken) return false;

  const hashedValue = hashDeviceToken(normalizedToken);
  if (terminal.device_token_hash && terminal.device_token_hash === hashedValue) {
    return true;
  }

  if (typeof terminal.device_token === "string") {
    const storedToken = terminal.device_token.trim();
    if (!storedToken) return false;
    return storedToken === normalizedToken || hashDeviceToken(storedToken) === hashedValue;
  }

  return false;
}

export async function requireTerminalDevice(request: Request, terminalId: string) {
  const token = request.headers.get("x-terminal-token")?.trim();
  if (!token || !terminalId) return { error: "Terminal authentication required", status: 401 as const };

  const supabase = createSupabaseServerClient();

  let terminal: { id: string; merchant_id: string; status: string; device_token_hash?: string | null; device_token?: string | null } | null = null;
  let queryError: Error | null = null;

  try {
    const { data, error } = await supabase
      .from("terminals")
      .select("id, merchant_id, status, device_token_hash, device_token")
      .eq("id", terminalId)
      .maybeSingle();

    if (error) {
      queryError = error;
    } else {
      terminal = data;
    }
  } catch (error) {
    queryError = error instanceof Error ? error : new Error("Terminal lookup failed");
  }

  if (!terminal && queryError) {
    console.warn("Terminal token lookup failed; falling back to legacy token match", queryError);
  }

  if (!terminal && !queryError) {
    const { data, error } = await supabase
      .from("terminals")
      .select("id, merchant_id, status, device_token")
      .eq("id", terminalId)
      .eq("device_token", token)
      .maybeSingle();

    terminal = data ?? null;
    if (error) {
      queryError = error;
    }
  }

  if (!terminal || !matchesTerminalDeviceToken(terminal, token) || ["revoked", "unpaired", "deleted"].includes(String(terminal.status).toLowerCase())) {
    if (queryError) {
      console.warn("Terminal authentication rejected due to lookup error", queryError);
    }
    return { error: "Terminal authentication failed", status: 401 as const };
  }

  return { terminal, supabase };
}
