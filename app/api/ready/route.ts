import { NextResponse } from "next/server";
import { getReadinessReport } from "@/lib/health/checks";

export async function GET() {
  const report = await getReadinessReport();
  return NextResponse.json(
    {
      status: report.status,
      generatedAt: report.generatedAt,
      network: report.network,
      checks: report.checks,
      environment: report.environment,
    },
    { status: report.status === "unhealthy" ? 503 : 200 },
  );
}
