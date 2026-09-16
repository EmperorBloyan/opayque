import { NextResponse } from "next/server";
import { getReadinessReport } from "@/lib/health/checks";

export async function GET() {
  try {
    const report = await getReadinessReport();
    return NextResponse.json(report, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Health report failed", error instanceof Error ? error.message : "Unknown health error");
    return NextResponse.json(
      {
        status: "unhealthy",
        generatedAt: new Date().toISOString(),
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet",
        checks: {},
        error: "Health checks could not be completed",
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
