import { NextResponse } from "next/server";
import { createSupabaseServerClient, getAuthenticatedUserId } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const developerId = await getAuthenticatedUserId(request);
    if (!developerId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const url = (body.url as string) || null;
    if (!url) {
      return NextResponse.json({ success: false, error: "Missing webhook url" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient(request);
    const { data, error } = await supabase
      .from("developer_webhooks")
      .insert({ developer_id: developerId, url })
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
