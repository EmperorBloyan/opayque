import { beforeEach, describe, expect, it, vi } from "vitest";

const MERCHANT_ID = "22222222-2222-4222-8222-222222222222";
const WALLET = "11111111111111111111111111111111";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  merchants: [] as Row[],
  pairingCodes: [] as Row[],
  terminals: [] as Row[],
}));

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  strictLimit: vi.fn(),
  getClientAddress: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/lib/rate-limit", () => ({ strictLimit: mocks.strictLimit, getClientAddress: mocks.getClientAddress }));

import { POST } from "./route";

function matches(row: Row, filters: Array<[string, unknown]>) {
  return filters.every(([key, value]) => row[key] === value);
}

function createClient(user: Row | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let operation: "select" | "insert" | "update" = "select";
      let payload: Row | Row[] | null = null;
      let selected = false;
      let insertedRows: Row[] | null = null;
      let updatedRows: Row[] | null = null;

      const rows = () => table === "merchants"
        ? state.merchants
        : table === "terminal_pairing_codes"
          ? state.pairingCodes
          : state.terminals;

      const result = () => {
        const matching = rows().filter((row) => matches(row, filters));
        if (operation === "insert") {
          const inserted = insertedRows ?? (Array.isArray(payload) ? payload : [payload as Row]);
          return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
        }
        if (operation === "update") {
          const updates = payload as Row;
          updatedRows = matching;
          matching.forEach((row) => Object.assign(row, updates));
        }
        const current = updatedRows ?? rows().filter((row) => matches(row, filters));
        return { data: current[0] ?? null, error: null };
      };

      const builder = {
        select: vi.fn(() => {
          selected = true;
          return builder;
        }),
        eq: vi.fn((key: string, value: unknown) => {
          filters.push([key, value]);
          return builder;
        }),
        maybeSingle: vi.fn(async () => result()),
        single: vi.fn(async () => result()),
        insert: vi.fn((value: Row | Row[]) => {
          operation = "insert";
          payload = value;
          insertedRows = Array.isArray(value) ? value : [value];
          rows().push(...insertedRows);
          return selected ? builder : builder;
        }),
        update: vi.fn((value: Row) => {
          operation = "update";
          payload = value;
          return builder;
        }),
      };
      return builder;
    },
  };
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/terminal/pairing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("terminal pairing API integration", () => {
  beforeEach(() => {
    state.merchants.length = 0;
    state.pairingCodes.length = 0;
    state.terminals.length = 0;
    vi.clearAllMocks();
    mocks.strictLimit.mockResolvedValue({ allowed: true });
    state.merchants.push({ id: MERCHANT_ID, auth_user_id: "user-1", wallet_address: WALLET, settlement_wallet_address: WALLET, merchant_name: "Test Merchant" });
    mocks.createSupabaseServerClient.mockImplementation((request?: Request) => createClient(request ? { id: "user-1" } : null));
  });

  it("creates and redeems a pairing code into one persisted terminal", async () => {
    const createResponse = await POST(request({
      action: "create",
      merchant_id: MERCHANT_ID,
      wallet_address: WALLET,
      terminal_label: "Counter 1",
    }));
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    expect(created).toMatchObject({ success: true, terminalLabel: "Counter 1" });
    expect(state.pairingCodes).toHaveLength(1);

    const verifyResponse = await POST(request({
      action: "verify",
      merchant_id: MERCHANT_ID,
      wallet_address: WALLET,
      code: created.code,
    }));
    expect(verifyResponse.status).toBe(200);
    const verified = await verifyResponse.json();
    expect(verified).toMatchObject({
      success: true,
      merchantId: MERCHANT_ID,
      walletAddress: WALLET,
      terminalLabel: "Counter 1",
    });
    expect(verified.terminalId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(verified.deviceToken).toBeTruthy();
    expect(state.pairingCodes[0]).toMatchObject({ status: "USED" });
    expect(state.terminals).toHaveLength(1);
    expect(state.terminals[0]).toMatchObject({ merchant_id: MERCHANT_ID, status: "online", label: "Counter 1" });
    expect(state.terminals[0].device_token_hash).toBeTruthy();
  });

  it("rejects a second redemption of the same code", async () => {
    state.pairingCodes.push({ code: "ABC234", merchant_id: MERCHANT_ID, status: "USED", expires_at: new Date(Date.now() + 60_000).toISOString(), terminal_label: "Counter 1" });

    const response = await POST(request({ action: "verify", code: "ABC234", merchant_id: MERCHANT_ID, wallet_address: WALLET }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ success: false, error: "PAIRING CODE REJECTED" });
    expect(state.terminals).toHaveLength(0);
  });

  it("blocks code creation without a persisted settlement wallet", async () => {
    state.merchants[0].wallet_address = null;
    state.merchants[0].settlement_wallet_address = null;

    const response = await POST(request({ action: "create", merchant_id: MERCHANT_ID, terminal_label: "Counter 1" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/settlement wallet/i) });
    expect(state.pairingCodes).toHaveLength(0);
  });
});
