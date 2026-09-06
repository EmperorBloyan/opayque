import { expect, test, type Page } from "@playwright/test";

const merchantWallet = "11111111111111111111111111111111";
const merchantId = "44444444-4444-4444-8444-444444444444";
const terminalId = "55555555-5555-4555-8555-555555555555";

function mockSupabaseAuth(page: Page) {
  return page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().includes("/token")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "test-token", refresh_token: "test-refresh", user: { id: "user-1", email: "merchant@example.com" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "merchant@example.com" }) });
  });
}

test("merchant login reaches the authenticated merchant profile", async ({ page }) => {
  await mockSupabaseAuth(page);
  await page.route("**/api/v1/merchant", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: { id: merchantId, merchant_name: "Test Merchant", settlement_wallet_address: merchantWallet, api_access_status: "active" } }) });
  });
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill("merchant@example.com");
  await page.getByPlaceholder("Enter password").fill("test-password");
  await page.getByRole("button", { name: "Unlock Hub" }).click();
  await expect(page).toHaveURL(/\/vault\/registry|\/vault/);
});

test("terminal amount entry creates a checkout link", async ({ page }) => {
  await page.addInitScript(({ merchantId: seededMerchantId, terminalId: seededTerminalId, wallet }) => {
    localStorage.setItem("opayque.device", JSON.stringify({ terminalId: seededTerminalId, merchantId: seededMerchantId, deviceToken: "device-token", merchantWallet: wallet, pairedAt: Date.now() }));
  }, { merchantId, terminalId, wallet: merchantWallet });
  await page.route("**/api/terminal/payments", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, id: "ledger-1", amount: 2.5, recipient_address: merchantWallet, status: "created" }) });
  });
  await page.route("**/api/terminal/bootstrap**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, terminalId, merchantId, merchantWallet, merchantName: "Test Merchant" }) });
  });
  await page.goto("/terminal");
  await page.getByLabel("Transaction Amount").fill("2.50");
  await page.getByRole("button", { name: "Generate QR" }).click();
  await expect(page.getByText(/checkout|scan|payment/i).first()).toBeVisible();
});

test("checkout page renders a deterministic payment request", async ({ page }) => {
  await page.goto(`/checkout?address=${merchantWallet}&amount=2.500000&fiat_amount=2.50&currency=USD&token=USDC&name=Test%20Merchant&session=session-1`);
  await expect(page.getByText("Test Merchant")).toBeVisible();
  await expect(page.getByText(/2\.50/)).toBeVisible();
  await expect(page.getByText(/USDC/i).first()).toBeVisible();
});
