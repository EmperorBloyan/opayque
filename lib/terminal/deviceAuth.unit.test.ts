import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient } = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient }));

import { hashDeviceToken, requireTerminalDevice } from "./deviceAuth";

describe("terminal device authentication", () => {
  beforeEach(() => {
    createSupabaseServerClient.mockReset();
  });

  it("hashes tokens deterministically without storing raw credentials", () => {
    expect(hashDeviceToken("terminal-secret")).toBe(hashDeviceToken("terminal-secret"));
    expect(hashDeviceToken("terminal-secret")).not.toBe("terminal-secret");
  });

  it("fails closed when the header or terminal id is missing", async () => {
    const request = new Request("http://localhost/api/terminal/payments");

    await expect(requireTerminalDevice(request, "")).resolves.toEqual({
      error: "Terminal authentication required",
      status: 401,
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it.each(["revoked", "unpaired", "deleted"])("rejects a %s terminal", async (status) => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "terminal-1", merchant_id: "merchant-1", status },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    createSupabaseServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    const request = new Request("http://localhost", { headers: { "x-terminal-token": "secret" } });
    await expect(requireTerminalDevice(request, "terminal-1")).resolves.toEqual({
      error: "Terminal authentication failed",
      status: 401,
    });
  });

  it("accepts only a matching hashed token and active terminal", async () => {
    const terminal = {
      id: "terminal-1",
      merchant_id: "merchant-1",
      status: "online",
      device_token_hash: hashDeviceToken("secret"),
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: terminal, error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const supabase = { from: vi.fn().mockReturnValue(query) };
    createSupabaseServerClient.mockReturnValue(supabase);

    const request = new Request("http://localhost", { headers: { "x-terminal-token": "secret" } });
    await expect(requireTerminalDevice(request, "terminal-1")).resolves.toEqual({ terminal, supabase });
  });

  it("rejects terminals without a hashed device token", async () => {
    const terminal = { id: "terminal-1", merchant_id: "merchant-1", status: "online", device_token: "secret" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: terminal, error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const supabase = { from: vi.fn().mockReturnValue(query) };
    createSupabaseServerClient.mockReturnValue(supabase);

    const request = new Request("http://localhost", { headers: { "x-terminal-token": "secret" } });
    await expect(requireTerminalDevice(request, "terminal-1")).resolves.toEqual({
      error: "Terminal authentication failed",
      status: 401,
    });
  });
});
