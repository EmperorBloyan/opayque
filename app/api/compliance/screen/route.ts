import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  merchantId: z.string(),
  businessName: z.string().min(2),
  country: z.string().length(2),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const highRisk = ['IR','NK','SY'].includes(data.country.toUpperCase());

    return NextResponse.json({
      success: true,
      data: { status: highRisk ? 'rejected' : 'approved', riskScore: highRisk ? 'high' : 'low' }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
