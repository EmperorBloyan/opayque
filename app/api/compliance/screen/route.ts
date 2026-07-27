import { NextResponse } from "next/server";

interface ComplianceScreenRequest {
  senderAddress?: string;
  amount?: number;
  merchantId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ComplianceScreenRequest;
    const senderAddress = body.senderAddress?.trim();

    if (!senderAddress) {
      return NextResponse.json({ success: false, error: "senderAddress is required" }, { status: 400 });
    }

    const restricted = ["0xdeadbeef", "OFAC-TEST-001"].includes(senderAddress.toUpperCase());
    const riskScore = senderAddress.length > 32 ? 0.6 : 0.2;

    return NextResponse.json({
      success: true,
      data: {
        allowed: !restricted,
        restricted,
        riskScore,
        recommendation: restricted ? "block" : riskScore > 0.5 ? "manual_review" : "allow",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Compliance screening failed" }, { status: 500 });
  }
}
