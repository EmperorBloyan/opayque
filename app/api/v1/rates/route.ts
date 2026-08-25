import { NextResponse } from 'next/server';

const CACHE_DURATION = 10 * 60 * 1000;
let cachedRates: { rates: Record<string, number>; asOf: string; source: string; expiresAt: number } | null = null;

async function fetchRates() {
  const endpoint = process.env.FX_RATES_URL || 'https://api.frankfurter.app/latest?from=USD';
  const source = process.env.FX_RATES_PROVIDER || 'frankfurter';
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`FX provider failed (${response.status})`);
  const payload = await response.json();
  const rates = Object.fromEntries(Object.entries(payload?.rates || {}).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => [key.toUpperCase(), Number(value)]));
  if (!Object.keys(rates).length) throw new Error('FX provider returned no rates');
  return { rates: { USD: 1, USDC: 1, ...rates }, asOf: payload?.date ? new Date(`${payload.date}T00:00:00Z`).toISOString() : new Date().toISOString(), source };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cachedRates && cachedRates.expiresAt > now) {
      return NextResponse.json({ base: 'USD', rates: cachedRates.rates, asOf: cachedRates.asOf, source: cachedRates.source, stale: false });
    }
    const fresh = await fetchRates();
    cachedRates = { ...fresh, expiresAt: now + CACHE_DURATION };
    return NextResponse.json({ base: 'USD', ...fresh, stale: false });
  } catch (error: unknown) {
    if (cachedRates) {
      return NextResponse.json({ base: 'USD', rates: cachedRates.rates, asOf: cachedRates.asOf, source: cachedRates.source, stale: true, warning: 'Approximate or stale rates' });
    }
    return NextResponse.json({ base: 'USD', rates: { USD: 1, USDC: 1 }, asOf: new Date().toISOString(), source: 'unavailable', stale: true, warning: 'Approximate rates unavailable' }, { status: 503 });
  }
}
