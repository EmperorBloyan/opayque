import { beforeEach, describe, expect, it } from "vitest";
import {
  bindAuthenticatedMerchantSession,
  clearActiveSession,
  getActiveMerchantId,
  getStoredMerchantId,
  loadTerminalDeviceCredential,
  saveTerminalDeviceCredential,
} from "./session";

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } },
  });
  return values;
}

describe("session and terminal credential persistence", () => {
  beforeEach(() => {
    installStorage();
    clearActiveSession();
  });

  it("binds an authenticated merchant without fabricating wallet auth", () => {
    bindAuthenticatedMerchantSession({ merchantId: "merchant-1", walletAddress: null });
    expect(getStoredMerchantId()).toBe("merchant-1");
    expect(getActiveMerchantId()).toBe("merchant-1");
  });

  it("ignores the placeholder merchant ID", () => {
    bindAuthenticatedMerchantSession({ merchantId: "merchant-vault" });
    expect(getStoredMerchantId()).toBeNull();
  });

  it("round-trips a terminal credential and rejects malformed storage", () => {
    saveTerminalDeviceCredential({ terminalId: "term-1", merchantId: "merchant-1", deviceToken: "token", merchantWallet: "wallet", pairedAt: Date.now() });
    expect(loadTerminalDeviceCredential()?.deviceToken).toBe("token");

    window.localStorage.setItem("opayque.device", JSON.stringify({ terminalId: "term-1" }));
    expect(loadTerminalDeviceCredential()).toBeNull();
  });
});
