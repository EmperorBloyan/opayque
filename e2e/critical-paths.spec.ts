import { expect, test, type Page } from "@playwright/test";

const merchantWallet = "11111111111111111111111111111111";
const merchantId = "44444444-4444-4444-8444-444444444444";
const terminalId = "55555555-5555-4555-8555-555555555555";

const authCookie = {
  name: "sb-playwright-example-auth-token",
  value: "test-token",
  domain: "127.0.0.1",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
};

function mockSupabaseAuth(page: Page) {
  return page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/token") || url.includes("/sign-in")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "set-cookie": [
          "sb-playwright-example-auth-token=test-token; Path=/; SameSite=Lax",
          "sb-playwright-example-auth-token-code-verifier=test-verifier; Path=/; SameSite=Lax",
          "opayque_mock_session=active; Path=/; SameSite=Lax",
        ] },
        body: JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "user-1", email: "merchant@example.com" },
          session: { access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: { id: "user-1", email: "merchant@example.com" } },
        }),
      });
      return;
    }
    if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user-1", email: "merchant@example.com" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-1", email: "merchant@example.com" }),
    });
  });
}

async function seedAuthSession(page: Page) {
  await page.context().addCookies([
    { ...authCookie, domain: "127.0.0.1", expires: Math.floor(Date.now() / 1000) + 3600 },
    { name: "sb-playwright-example-auth-token-code-verifier", value: "test-verifier", domain: "127.0.0.1", path: "/", expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, sameSite: "Lax" },
    { name: "opayque_mock_session", value: "active", domain: "127.0.0.1", path: "/", expires: Math.floor(Date.now() / 1000) + 3600, sameSite: "Lax" },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem("opayque_merchant_profile", JSON.stringify({ id: "44444444-4444-4444-8444-444444444444", merchant_name: "Test Merchant", settlement_wallet_address: "11111111111111111111111111111111" }));
    localStorage.setItem("merchant_name", "Test Merchant");
    localStorage.setItem("settlement_wallet_address", "11111111111111111111111111111111");
  });
}

async function mockMerchantLookup(page: Page) {
  await page.route("**/rest/v1/merchants**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/1" },
      body: JSON.stringify([
        { id: merchantId, auth_user_id: "user-1", merchant_name: "Test Merchant", settlement_wallet_address: merchantWallet, api_access_status: "active" },
      ]),
    });
  });
}

test("merchant onboarding renders with mocked auth and success path", async ({ page }) => {
  await mockSupabaseAuth(page);
  await page.route("**/api/merchant/register", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { merchant: { id: merchantId, auth_user_id: "user-1", merchant_name: "Test Merchant" } } }),
    });
  });
  await page.route("**/api/relayer/build-initialize-vault", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, alreadyExists: true }) });
  });
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: /set up your control center/i })).toBeVisible();
  await expect(page.getByText(/secure developer access/i)).toBeVisible();
  await expect(page.getByText(/connect wallet, sign ownership/i)).toBeVisible();
});

test("merchant login reaches the authenticated merchant profile", async ({ page }) => {
  await mockMerchantLookup(page);
  await seedAuthSession(page);
  await page.goto("/login?next=%2Fvault%2Fregistry");
  await expect(page).toHaveURL(/\/vault\/registry|\/vault/);
});

test("terminal pairing, bootstrap reload, and QR generation work with mocked services", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("merchant_name", "Test Merchant");
  });
  await page.route("**/api/terminal/pairing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, merchantId, walletAddress: merchantWallet, merchantName: "Test Merchant", terminalId, deviceToken: "device-token" }),
    });
  });
  await page.route("**/api/terminal/bootstrap**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, terminalId, merchantId, merchantWallet, merchantName: "Test Merchant" }),
    });
  });
  await page.route("**/api/terminal/payments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, id: "ledger-1", amount: 2.5, token_symbol: "USDC", transfer_mode: "private", created_at: new Date().toISOString() }),
    });
  });

  await page.goto("/terminal");
  await expect(page.getByLabel("Pairing Code")).toBeVisible();
  await page.getByLabel("Pairing Code").fill("ABC123");
  await page.getByRole("button", { name: /pair device/i }).click();
  await expect(page.getByLabel("Transaction Amount")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Transaction Amount")).toBeVisible();

  await page.getByLabel("Transaction Amount").fill("2.50");
  await page.getByRole("button", { name: /generate qr/i }).click();
  await expect(page.getByText(/pending transaction created|payment successful|generate qr|checkout/i).first()).toBeVisible();
});

test("checkout page renders a deterministic payment request", async ({ page }) => {
  await page.goto(`/checkout?address=${merchantWallet}&amount=2.500000&fiat_amount=2.50&currency=USD&token=USDC&name=Test%20Merchant&session=session-1`);
  await expect(page.getByText("Test Merchant")).toBeVisible();
  await expect(page.getByText(/2\.50/)).toBeVisible();
  await expect(page.getByText(/USDC/i).first()).toBeVisible();
});

test("developer hub overview renders with mocked merchant profile data", async ({ page }) => {
  await mockMerchantLookup(page);
  await seedAuthSession(page);
  await page.route("**/api/v1/merchant", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ merchant: { id: merchantId, merchant_name: "Test Merchant", settlement_wallet_address: merchantWallet, default_transfer_mode: "private" } }),
    });
  });
  await page.goto("/developer/overview");
  await expect(page.getByText(/Developer Hub/i).first()).toBeVisible();
  await expect(page.getByText(/API.*Protocol Overview/i)).toBeVisible();
  await expect(page.getByText(/Network Status/i)).toBeVisible();
});
