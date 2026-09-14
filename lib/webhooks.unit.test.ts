import { afterEach, describe, expect, it, vi } from "vitest";
import dispatchWebhook from "./webhooks";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

describe("webhook dispatch", () => {
  it("sends JSON and an HMAC signature when a secret is configured", async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await expect(dispatchWebhook("https://merchant.example/webhook", { type: "payment.created" }, "secret")).resolves.toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-Opayque-Signature"]).toMatch(/^[a-f0-9]{64}$/);
    expect(init.body).toBe(JSON.stringify({ type: "payment.created" }));
  });

  it("returns false for upstream failures and network errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error("offline"));

    await expect(dispatchWebhook("https://merchant.example/webhook", {})).resolves.toBe(false);
    await expect(dispatchWebhook("https://merchant.example/webhook", {})).resolves.toBe(false);
  });
});