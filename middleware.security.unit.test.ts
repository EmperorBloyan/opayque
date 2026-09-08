import { describe, expect, it } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from './middleware';

describe('middleware security headers', () => {
  it('applies the hardened response headers to redirect responses', () => {
    const response = applySecurityHeaders(NextResponse.redirect('https://example.com/login'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('applies headers to a normal response object', () => {
    const request = new NextRequest('https://example.com/vault/dashboard');
    const response = applySecurityHeaders(NextResponse.json({ ok: true }, { status: 200 }));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Strict-Transport-Security') || 'not-set').toBe('not-set');
    expect(request.nextUrl.pathname).toBe('/vault/dashboard');
  });
});
