import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTerminalDevice: vi.fn(),
  dispatchWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/terminal/deviceAuth", () => ({ requireTerminalDevice: mocks.requireTerminalDevice }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: mocks.dispatchWebhookEvent }));
vi.mock("@/lib/solana/constants", () => ({
  getSolanaNetwork: () => "devnet",
  isDevnetNetwork: () => true,
  getAssetMintAddress: () => "usdc-mint",
}));

import { POST } from "./route";

function query(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe("terminal transfer mode snapshot", () => {
  it("stores the merchant public default on the created ledger intent", async () => {
    const merchantQuery = query({
      wallet_address: "merchant-wallet",
      settlement_wallet_address: null,
      default_transfer_mode: "public",
    });
    const insertQuery = query({
      id: "ledger-public",
      transfer_mode: "public",
      status: "created",
    });
    const supabase = {
      from: vi.fn().mockReturnValueOnce(merchantQuery).mockReturnValueOnce(insertQuery),
    };
    mocks.requireTerminalDevice.mockResolvedValue({
      terminal: { id: "terminal-1", merchant_id: "11111111-1111-4111-8111-111111111111", status: "online" },
      supabase,
    });

    const response = await POST(new Request("http://localhost/api/terminal/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ terminalId: "terminal-1", amount: 2.5, tokenSymbol: "USDC" }),
    }));

    expect(response.status).toBe(200);
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ transfer_mode: "public" }));
  });
});
