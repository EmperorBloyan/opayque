import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  requireTerminalDevice: vi.fn(),
  dispatchWebhookEvent: vi.fn(),
  getSolanaNetwork: vi.fn(() => "devnet"),
  isDevnetNetwork: vi.fn(() => true),
  getAssetMintAddress: vi.fn(() => "usdc-mint"),
}));

const MERCHANT_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/terminal/deviceAuth", () => ({ requireTerminalDevice: mocks.requireTerminalDevice }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: mocks.dispatchWebhookEvent }));
vi.mock("@/lib/solana/constants", () => ({
  getSolanaNetwork: mocks.getSolanaNetwork,
  isDevnetNetwork: mocks.isDevnetNetwork,
  getAssetMintAddress: mocks.getAssetMintAddress,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/terminal/payments", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function queryResult(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return query;
}

describe("terminal payment API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTerminalDevice.mockReset();
    mocks.createSupabaseServerClient.mockReset();
    mocks.dispatchWebhookEvent.mockReset();
    mocks.requireTerminalDevice.mockResolvedValue({
      terminal: { id: "terminal-1", merchant_id: MERCHANT_ID, status: "online" },
      supabase: { from: vi.fn() },
    });
    mocks.dispatchWebhookEvent.mockResolvedValue({ dispatched: 1 });
  });

  it("rejects malformed payment input before terminal authentication", async () => {
    const response = await POST(request({ terminalId: "terminal-1", amount: 0, tokenSymbol: "SOL" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
    expect(mocks.requireTerminalDevice).not.toHaveBeenCalled();
  });

  it("fails closed when the terminal token is invalid", async () => {
    mocks.requireTerminalDevice.mockResolvedValue({ error: "Terminal authentication failed", status: 401 });

    const response = await POST(request(
      { terminalId: "terminal-1", amount: 12.5, tokenSymbol: "USDC" },
      { "x-terminal-token": "wrong" },
    ));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: "Terminal authentication failed" });
  });

  it("returns an existing ledger row for a duplicate idempotency key", async () => {
    const existing = { id: "ledger-1", status: "created", amount: 12.5, idempotency_key: "order-1" };
    const idempotencyQuery = queryResult(existing);
    const supabase = { from: vi.fn().mockReturnValue(idempotencyQuery) };
    mocks.requireTerminalDevice.mockResolvedValue({
      terminal: { id: "terminal-1", merchant_id: MERCHANT_ID, status: "online" },
      supabase,
    });

    const response = await POST(request(
      { terminalId: "terminal-1", amount: 12.5, tokenSymbol: "USDC" },
      { "Idempotency-Key": "order-1" },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, idempotent: true, id: "ledger-1" });
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });

  it("writes a created ledger row and dispatches payment.created", async () => {
    const inserted = {
      id: "ledger-2",
      merchant_id: MERCHANT_ID,
      terminal_id: "terminal-1",
      status: "created",
      amount: 12.5,
      recipient_address: "merchant-wallet",
    };
    const idempotencyQuery = queryResult(null);
    const merchantQuery = queryResult({ wallet_address: "merchant-wallet", settlement_wallet_address: null });
    const insertQuery = queryResult(inserted);
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(idempotencyQuery)
        .mockReturnValueOnce(merchantQuery)
        .mockReturnValueOnce(insertQuery),
    };
    mocks.requireTerminalDevice.mockResolvedValue({
      terminal: { id: "terminal-1", merchant_id: MERCHANT_ID, status: "online" },
      supabase,
    });

    const response = await POST(request(
      { terminalId: "terminal-1", amount: 12.5, tokenSymbol: "USDC", idempotencyKey: "order-2" },
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, id: "ledger-2" });
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      merchant_id: MERCHANT_ID,
      terminal_id: "terminal-1",
      status: "created",
      amount_base_units: 12_500_000,
      idempotency_key: "order-2",
      recipient_address: "merchant-wallet",
    }));
    expect(mocks.dispatchWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      merchantId: MERCHANT_ID,
      eventType: "payment.created",
      payload: inserted,
    }));
  });

  it("does not create a ledger row when the merchant wallet is missing", async () => {
    const merchantQuery = queryResult({ wallet_address: null, settlement_wallet_address: null });
    const supabase = { from: vi.fn().mockReturnValue(merchantQuery) };
    mocks.requireTerminalDevice.mockResolvedValue({
      terminal: { id: "terminal-1", merchant_id: MERCHANT_ID, status: "online" },
      supabase,
    });

    const response = await POST(request({ terminalId: "terminal-1", amount: 12.5, tokenSymbol: "USDC" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/wallet/i) });
    expect(mocks.dispatchWebhookEvent).not.toHaveBeenCalled();
  });
});
