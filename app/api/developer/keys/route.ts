import { NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthenticatedUserId } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const developerId = await getAuthenticatedUserId(request);
    if (!developerId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServerClient(request);
    const { data, error } = await supabase
      .from("developer_keys")
      .select("*")
      .eq("developer_id", developerId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const developerId = await getAuthenticatedUserId(request);
    if (!developerId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const label = (body.label as string) || "Unnamed Key";

    const supabase = createSupabaseServerClient(request);
    const { data, error } = await supabase
      .from("developer_keys")
      .insert({ developer_id: developerId, label })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
