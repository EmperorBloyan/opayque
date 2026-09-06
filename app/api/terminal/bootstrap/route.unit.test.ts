import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));

import { GET } from "./route";

function request(terminalId = "terminal-1", deviceToken = "secret") {
  return new Request(`http://localhost/api/terminal/bootstrap?terminalId=${terminalId}&deviceToken=${deviceToken}`);
}

function client(terminal: Record<string, unknown> | null, merchant: Record<string, unknown> | null = null, error: Record<string, unknown> | null = null) {
  const terminalQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: terminal, error }),
  };
  const merchantQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: merchant, error: null }),
  };
  return {
    from: vi.fn((table: string) => table === "terminals" ? terminalQuery : merchantQuery),
  };
}

describe("terminal bootstrap route", () => {
  beforeEach(() => mocks.createSupabaseServerClient.mockReset());

  it("rejects missing credentials before querying Supabase", async () => {
    const response = await GET(new Request("http://localhost/api/terminal/bootstrap"));
    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("rejects a token that does not match the persisted hash", async () => {
    mocks.createSupabaseServerClient.mockReturnValue(client({
      id: "terminal-1",
      merchant_id: "22222222-2222-4222-8222-222222222222",
      device_token_hash: "not-the-secret-hash",
      status: "online",
    }));

    const response = await GET(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Terminal authentication failed. Pair this terminal again." });
  });

  it("rejects terminals with no persisted token hash", async () => {
    mocks.createSupabaseServerClient.mockReturnValue(client({
      id: "terminal-1",
      merchant_id: "22222222-2222-4222-8222-222222222222",
      device_token_hash: null,
      status: "online",
    }));

    expect((await GET(request())).status).toBe(401);
  });

  it("hydrates a paired terminal from a matching token", async () => {
    const { hashDeviceToken } = await import("@/lib/terminal/deviceAuth");
    mocks.createSupabaseServerClient.mockReturnValue(client({
      id: "terminal-1",
      merchant_id: "22222222-2222-4222-8222-222222222222",
      device_token_hash: hashDeviceToken("secret"),
      status: "online",
    }, {
      id: "22222222-2222-4222-8222-222222222222",
      merchant_name: "Test Merchant",
      merchant_logo: null,
      wallet_address: null,
      settlement_wallet_address: "11111111111111111111111111111111",
    }));

    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      terminalId: "terminal-1",
      merchantId: "22222222-2222-4222-8222-222222222222",
    });
  });
});