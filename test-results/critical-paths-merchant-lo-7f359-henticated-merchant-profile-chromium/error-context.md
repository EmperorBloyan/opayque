# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-paths.spec.ts >> merchant login reaches the authenticated merchant profile
- Location: e2e/critical-paths.spec.ts:17:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/vault\/registry|\/vault/
Received string:  "http://127.0.0.1:3000/login"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en" class="dark">…</html>
       - unexpected value "http://127.0.0.1:3000/login"

```

```yaml
- main:
  - button "Return to home":
    - img
  - paragraph: Access Control Center
  - heading "Secure Hub Unlock" [level=1]
  - paragraph: Re-enter your credentials to restore access to your developer workspace.
  - text: O
  - paragraph: Merchant Identity
  - heading "Opayque Merchant" [level=2]
  - paragraph: Enter your company password to unlock the developer hub and continue managing your merchant session.
  - text: Email address
  - img
  - textbox "Email address":
    - /placeholder: you@company.com
    - text: merchant@example.com
  - text: Password
  - img
  - textbox "Password":
    - /placeholder: Enter password
    - text: test-password
  - text: Invalid email or password. Please check your credentials and try again.
  - button "Create Account":
    - img
    - text: Create Account
  - button "Unlock Hub":
    - text: Unlock Hub
    - img
- alert
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | const merchantWallet = "11111111111111111111111111111111";
  4  | const merchantId = "44444444-4444-4444-8444-444444444444";
  5  | const terminalId = "55555555-5555-4555-8555-555555555555";
  6  | 
  7  | function mockSupabaseAuth(page: Page) {
  8  |   return page.route("**/auth/v1/**", async (route) => {
  9  |     if (route.request().url().includes("/token")) {
  10 |       await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "test-token", refresh_token: "test-refresh", user: { id: "user-1", email: "merchant@example.com" } }) });
  11 |       return;
  12 |     }
  13 |     await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-1", email: "merchant@example.com" }) });
  14 |   });
  15 | }
  16 | 
  17 | test("merchant login reaches the authenticated merchant profile", async ({ page }) => {
  18 |   await mockSupabaseAuth(page);
  19 |   await page.route("**/api/v1/merchant", async (route) => {
  20 |     await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: { id: merchantId, merchant_name: "Test Merchant", settlement_wallet_address: merchantWallet, api_access_status: "active" } }) });
  21 |   });
  22 |   await page.goto("/login");
  23 |   await page.getByPlaceholder("you@company.com").fill("merchant@example.com");
  24 |   await page.getByPlaceholder("Enter password").fill("test-password");
  25 |   await page.getByRole("button", { name: "Unlock Hub" }).click();
> 26 |   await expect(page).toHaveURL(/\/vault\/registry|\/vault/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  27 | });
  28 | 
  29 | test("terminal amount entry creates a checkout link", async ({ page }) => {
  30 |   await page.addInitScript(({ merchantId: seededMerchantId, terminalId: seededTerminalId, wallet }) => {
  31 |     localStorage.setItem("opayque.device", JSON.stringify({ terminalId: seededTerminalId, merchantId: seededMerchantId, deviceToken: "device-token", merchantWallet: wallet, pairedAt: Date.now() }));
  32 |   }, { merchantId, terminalId, wallet: merchantWallet });
  33 |   await page.route("**/api/terminal/payments", async (route) => {
  34 |     await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, id: "ledger-1", amount: 2.5, recipient_address: merchantWallet, status: "created" }) });
  35 |   });
  36 |   await page.route("**/api/terminal/bootstrap**", async (route) => {
  37 |     await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, terminalId, merchantId, merchantWallet, merchantName: "Test Merchant" }) });
  38 |   });
  39 |   await page.goto("/terminal");
  40 |   await page.getByLabel("Transaction Amount").fill("2.50");
  41 |   await page.getByRole("button", { name: "Generate QR" }).click();
  42 |   await expect(page.getByText(/checkout|scan|payment/i).first()).toBeVisible();
  43 | });
  44 | 
  45 | test("checkout page renders a deterministic payment request", async ({ page }) => {
  46 |   await page.goto(`/checkout?address=${merchantWallet}&amount=2.500000&fiat_amount=2.50&currency=USD&token=USDC&name=Test%20Merchant&session=session-1`);
  47 |   await expect(page.getByText("Test Merchant")).toBeVisible();
  48 |   await expect(page.getByText(/2\.50/)).toBeVisible();
  49 |   await expect(page.getByText(/USDC/i).first()).toBeVisible();
  50 | });
  51 | 
```