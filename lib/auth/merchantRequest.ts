import { PublicKey } from "@solana/web3.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOwnedMerchantForWallet(request: Request, walletAddress: string) {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletAddress);
  } catch {
    return { error: "Invalid merchant wallet address", status: 400 as const };
  }

  const supabase = createSupabaseServerClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Unauthorized", status: 401 as const };

  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("id, wallet_address, settlement_wallet_address")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) return { error: "Unable to resolve merchant profile", status: 500 as const };
  if (!merchant) return { error: "Merchant profile not found", status: 403 as const };

  const ownedWallets = [merchant.wallet_address, merchant.settlement_wallet_address]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  if (!ownedWallets.includes(wallet.toBase58())) {
    return { error: "Merchant wallet does not match the authenticated merchant", status: 403 as const };
  }

  return { merchant, user, supabase };
}
