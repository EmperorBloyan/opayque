import { NextResponse } from "next/server";
import { getReadinessReport } from "@/lib/health/checks";

export async function GET() {
  const report = await getReadinessReport();
  return NextResponse.json(report, {
    status: report.status === "unhealthy" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
