import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveMerchantAccessStatus } from "@/lib/auth/merchantAccess";
import { isTransferMode, normalizeTransferMode } from "@/lib/payments/transferMode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasRecentAuthentication } from "@/lib/auth/recentAuth";

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
  "id, email, merchant_name, merchant_logo, secondary_email, onboarding_status, api_access_status, wallet_address, settlement_wallet_address, refund_wallet_address, website_url, webhook_url, tee_enforcement_enabled, default_transfer_mode, auth_user_id";

function normalizeMerchant(merchant: any) {
  if (!merchant) return null;
  return {
    ...merchant,
    api_access_status: resolveMerchantAccessStatus(merchant.api_access_status),
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
      // RLS intentionally hides unlinked merchant rows from the browser client.
      // Use the service-role client only after Auth has verified this user's email.
      const adminSupabase = createSupabaseServerClient();
      const fallback = await adminSupabase
        .from("merchants")
        .select(MERCHANT_SELECT)
        .eq("email", user.email)
        .maybeSingle();

      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }

      if (fallback.data) {
        const fallbackMerchant = fallback.data;
        merchant = fallbackMerchant;

        // Self-heal link if possible
        if (!fallbackMerchant.auth_user_id) {
          const { error: linkError } = await adminSupabase
            .from("merchants")
            .update({
              auth_user_id: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", fallbackMerchant.id);
          if (linkError) {
            return NextResponse.json({ error: "Merchant account link could not be repaired" }, { status: 500 });
          }
          fallbackMerchant.auth_user_id = user.id;
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
        defaultTransferMode,
    } = body;

      if (defaultTransferMode !== undefined && !isTransferMode(defaultTransferMode)) {
        return NextResponse.json({ error: "defaultTransferMode must be private or public" }, { status: 400 });
      }

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

    if (typeof email === "string" && email.trim() !== (user.email ?? "").trim() && !hasRecentAuthentication(user.last_sign_in_at)) {
      return NextResponse.json({ error: "Recent password confirmation required before changing email" }, { status: 428 });
    }
    if (typeof email === "string") updates.email = email;
    if (refundWalletAddress !== undefined) {
      updates.refund_wallet_address = refundWalletAddress;
    }
    if (websiteUrl !== undefined) updates.website_url = websiteUrl;
    if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
    if (teeEnforcementEnabled !== undefined) {
      updates.tee_enforcement_enabled = teeEnforcementEnabled;
    }
    if (defaultTransferMode !== undefined) {
      updates.default_transfer_mode = normalizeTransferMode(defaultTransferMode);
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
      return NextResponse.json(
        { error: "Merchant profile not found. Complete onboarding before editing merchant details." },
        { status: 404 }
      );
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