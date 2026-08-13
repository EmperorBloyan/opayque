import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

// GET: Load merchant's webhook settings
export async function GET() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("webhook_configs")
      .select("destination_url, signing_secret, subscribed_events")
      .eq("merchant_id", "default_merchant")
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return NextResponse.json({
      endpoint: data?.destination_url || "",
      secret: data?.signing_secret || "whsec_000000000000000000000000",
      subscribed_events: data?.subscribed_events || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Save updated endpoint or event subscriptions
export async function POST(req: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { endpoint, subscribed_events } = body;

    const { data, error } = await supabase
      .from("webhook_configs")
      .upsert(
        {
          merchant_id: "default_merchant",
          destination_url: endpoint,
          subscribed_events: subscribed_events,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
