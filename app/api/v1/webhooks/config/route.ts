import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";

async function getContext() {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: merchant } = await supabase.from("merchants").select("id").eq("auth_user_id", user.id).maybeSingle();
  return merchant?.id ? { supabase, merchantId: merchant.id } : null;
}

// GET: Load merchant's webhook settings
export async function GET() {
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await context.supabase.from("webhook_configs").select("destination_url, subscribed_events").eq("merchant_id", context.merchantId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load webhook configuration" }, { status: 500 });
  return NextResponse.json({ endpoint: data?.destination_url || "", subscribed_events: data?.subscribed_events || [] });
}

// POST: Save updated endpoint or event subscriptions
export async function POST(req: Request) {
  const limit = await strictLimit(`webhooks:config:${getClientAddress(req)}`, true);
  if (!limit.allowed) return NextResponse.json({ error: limit.error || "Too many requests" }, { status: limit.error ? 503 : 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  const context = await getContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const events = Array.isArray(body.subscribed_events) ? body.subscribed_events.filter((event: unknown): event is string => typeof event === "string" && event.length <= 80).slice(0, 50) : [];
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
    } catch {
      return NextResponse.json({ error: "Webhook endpoint must be a valid HTTPS URL" }, { status: 400 });
    }
  }
  const { error } = await context.supabase.from("webhook_configs").upsert({ merchant_id: context.merchantId, destination_url: endpoint, subscribed_events: events, updated_at: new Date().toISOString() }, { onConflict: "merchant_id" });
  if (error) return NextResponse.json({ error: "Unable to save webhook configuration" }, { status: 500 });
  return NextResponse.json({ success: true, endpoint, subscribed_events: events });
}
