import { NextResponse } from 'next/server';

// In-memory cache to prevent rate-limiting and speed up responses (expires in 15 mins)
let cachedRates: { data: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 15 * 60 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedRates && now - cachedRates.timestamp < CACHE_DURATION) {
      return NextResponse.json({ success: true, rates: cachedRates.data });
    }

    // Fetching base USD rates (USDC is pegged 1:1 to USD)
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Failed to fetch exchange rates');

    const data = await res.json();
    
    cachedRates = {
      data: data.rates,
      timestamp: now,
    };

    return NextResponse.json({ success: true, rates: data.rates });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
