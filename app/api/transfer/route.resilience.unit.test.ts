import { beforeEach, describe, expect, it, vi } from "vitest";

const MERCHANT_ID = "33333333-3333-4333-8333-333333333333";
const SENDER = "11111111111111111111111111111111";
const RECIPIENT = "So11111111111111111111111111111111111111112";
const MINT = "11111111111111111111111111111111";

const mocks = vi.hoisted(() => ({
  requestPrivateSplTransfer: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  strictLimit: vi.fn(),
  getClientAddress: vi.fn(() => "127.0.0.1"),
  getAssetMintAddress: vi.fn(() => MINT),
  getSolanaNetwork: vi.fn(() => "devnet"),
  isDevnetNetwork: vi.fn(() => true),
  captureException: vi.fn(),
  logLifecycle: vi.fn(),
}));

vi.mock("@/lib/magicblock", () => ({ requestPrivateSplTransfer: mocks.requestPrivateSplTransfer }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", () => ({ strictLimit: mocks.strictLimit, getClientAddress: mocks.getClientAddress }));
vi.mock("@/lib/solana/constants", () => ({
  getAssetMintAddress: mocks.getAssetMintAddress,
  getSolanaNetwork: mocks.getSolanaNetwork,
  isDevnetNetwork: mocks.isDevnetNetwork,
}));
vi.mock("@/lib/sentry", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/observability", () => ({ logLifecycle: mocks.logLifecycle }));

import { POST } from "./route";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/transfer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sender: SENDER, recipient: RECIPIENT, amount: 1.25, mint: MINT, intent_id: "intent-1", ...overrides }),
  });
}

function query(result: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error }),
  };
}

function configureSupabase() {
  const intentQuery = query({ id: "ledger-1", merchant_id: MERCHANT_ID, amount: 1.25, status: "created" });
  const merchantQuery = query({ settlement_wallet_address: RECIPIENT, wallet_address: null });
  const updateQuery = query({ id: "ledger-1", status: "pending_signature" });
  const from = vi.fn()
    .mockReturnValueOnce(intentQuery)
    .mockReturnValueOnce(merchantQuery)
    .mockReturnValueOnce(updateQuery);
  const supabase = { from };
  mocks.createSupabaseServerClient.mockReturnValue(supabase);
  return { from, updateQuery };
}

describe("transfer route resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.strictLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.requestPrivateSplTransfer.mockResolvedValue({ transaction: "tx", blockhash: "blockhash", lastValidBlockHeight: 10, rpcUrl: "rpc" });
  });

  it("fails closed on rate-limit exhaustion before reading or mutating the ledger", async () => {
    mocks.strictLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 17, error: "Rate limiter unavailable" });
    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.requestPrivateSplTransfer).not.toHaveBeenCalled();
  });

  it("does not move the ledger when MagicBlock times out", async () => {
    const { updateQuery } = configureSupabase();
    mocks.requestPrivateSplTransfer.mockRejectedValue(new Error("MagicBlock request timed out"));

    const response = await POST(request());

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: "MagicBlock request timed out" });
    expect(updateQuery.update).not.toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalled();
  });

  it("recovers on a subsequent RPC/MagicBlock attempt without corrupting the ledger", async () => {
    const first = configureSupabase();
    mocks.requestPrivateSplTransfer.mockRejectedValueOnce(new Error("MagicBlock upstream unavailable"));
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    expect(first.updateQuery.update).not.toHaveBeenCalled();

    const second = configureSupabase();
    const recovered = await POST(request({ intent_id: "intent-2" }));
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ success: true, transaction: "tx", mode: "private" });
    expect(second.updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_signature", amount_base_units: 1_250_000 }));
  });

  it("rejects a replayed or terminal intent before calling MagicBlock", async () => {
    const terminalIntent = query({ id: "ledger-1", merchant_id: MERCHANT_ID, amount: 1.25, status: "confirmed" });
    mocks.createSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(terminalIntent) });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.requestPrivateSplTransfer).not.toHaveBeenCalled();
  });
});
