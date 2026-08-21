import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveMerchantAccessStatus } from "@/lib/auth/merchantAccess";

function createSupabaseFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore in edge/server component constraints
          }
        },
      },
    }
  );
}

const MERCHANT_SELECT =
  "id, email, merchant_name, merchant_logo, secondary_email, onboarding_status, api_access_status, settlement_wallet_address, refund_wallet_address, website_url, webhook_url, tee_enforcement_enabled, api_key, auth_user_id";

function normalizeMerchant(merchant: any) {
  if (!merchant) return null;
  return {
    ...merchant,
    api_access_status: resolveMerchantAccessStatus(
      merchant.api_access_status,
      merchant.api_key
    ),
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseFromCookies(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Primary: auth_user_id link
    let { data: merchant, error } = await supabase
      .from("merchants")
      .select(MERCHANT_SELECT)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Fallback for legacy rows missing auth_user_id but matching email
    if (!merchant && user.email) {
      const fallback = await supabase
        .from("merchants")
        .select(MERCHANT_SELECT)
        .eq("email", user.email)
        .maybeSingle();

      if (!fallback.error && fallback.data) {
        merchant = fallback.data;

        // Self-heal link if possible
        if (!merchant.auth_user_id) {
          await supabase
            .from("merchants")
            .update({
              auth_user_id: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", merchant.id);
          merchant.auth_user_id = user.id;
        }
      }
    }

    return NextResponse.json({ merchant: normalizeMerchant(merchant) });
  } catch (err: any) {
    console.error("GET /api/v1/merchant error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseFromCookies(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      email,
      merchantName,
      merchantLogo,
      secondaryEmail,
      settlementWalletAddress,
      refundWalletAddress,
      websiteUrl,
      webhookUrl,
      teeEnforcementEnabled,
    } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      auth_user_id: user.id,
    };

    if (email !== undefined) updates.email = email;
    if (merchantName !== undefined) updates.merchant_name = merchantName;
    if (merchantLogo !== undefined) updates.merchant_logo = merchantLogo;
    if (secondaryEmail !== undefined) updates.secondary_email = secondaryEmail;
    if (settlementWalletAddress !== undefined) {
      updates.settlement_wallet_address = settlementWalletAddress;
    }
    if (refundWalletAddress !== undefined) {
      updates.refund_wallet_address = refundWalletAddress;
    }
    if (websiteUrl !== undefined) updates.website_url = websiteUrl;
    if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
    if (teeEnforcementEnabled !== undefined) {
      updates.tee_enforcement_enabled = teeEnforcementEnabled;
    }

    if (
      email !== undefined ||
      merchantName !== undefined ||
      merchantLogo !== undefined ||
      secondaryEmail !== undefined ||
      settlementWalletAddress !== undefined ||
      refundWalletAddress !== undefined ||
      websiteUrl !== undefined ||
      webhookUrl !== undefined
    ) {
      updates.api_access_status = "active";
      updates.onboarding_status = "completed";
    }

    const { data: existing } = await supabase
      .from("merchants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    let dbResult;

    if (existing?.id) {
      dbResult = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", existing.id)
        .select(MERCHANT_SELECT)
        .maybeSingle();
    } else {
      dbResult = await supabase
        .from("merchants")
        .insert({
          ...updates,
          auth_user_id: user.id,
          email: updates.email ?? user.email ?? null,
          onboarding_status: "completed",
          api_access_status: updates.api_access_status || "active",
          created_at: new Date().toISOString(),
        })
        .select(MERCHANT_SELECT)
        .maybeSingle();
    }

    const { data: merchant, error } = dbResult;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ merchant: normalizeMerchant(merchant) });
  } catch (err: any) {
    console.error("PATCH /api/v1/merchant error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}