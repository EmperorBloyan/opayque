import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export async function getAuthenticatedMerchantId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: merchant, error } = await supabase
    .from("merchants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !merchant?.id) return null;
  return merchant.id;
}
