import crypto from "node:crypto";

export type ComplianceProviderName = "null" | "demo" | "sumsub";
export type ComplianceStatus = "not_configured" | "pending" | "approved" | "rejected" | "review";

export interface ScreenMerchantInput {
  merchantId: string;
  businessName: string;
  country: string;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  riskScore: string | null;
  providerRef: string | null;
  webSdkToken?: string;
  message: string;
}

export interface ComplianceProvider {
  readonly name: ComplianceProviderName;
  isConfigured(): boolean;
  screenMerchant(input: ScreenMerchantInput): Promise<ComplianceResult>;
}

export class NullComplianceProvider implements ComplianceProvider {
  readonly name = "null" as const;

  isConfigured() {
    return false;
  }

  async screenMerchant(_input: ScreenMerchantInput): Promise<ComplianceResult> {
    return {
      status: "not_configured",
      riskScore: null,
      providerRef: null,
      message: "Compliance screening is not configured. This is not a KYB or KYC decision.",
    };
  }
}

export class DemoComplianceProvider implements ComplianceProvider {
  readonly name = "demo" as const;

  isConfigured() {
    return true;
  }

  async screenMerchant(input: ScreenMerchantInput): Promise<ComplianceResult> {
    const highRisk = ["IR", "NK", "SY"].includes(input.country.toUpperCase());
    return {
      status: highRisk ? "rejected" : "review",
      riskScore: highRisk ? "high" : "unknown",
      providerRef: `demo:${Date.now()}`,
      message: "Demo screening only. This is not a KYB or KYC decision.",
    };
  }
}

function sumsubSignature(secret: string, timestamp: string, method: string, path: string, body: string) {
  return crypto.createHmac("sha256", secret).update(timestamp + method.toUpperCase() + path + body).digest("hex");
}

export class SumsubComplianceProvider implements ComplianceProvider {
  readonly name = "sumsub" as const;
  private readonly appToken: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;
  private readonly levelName: string;

  constructor(options: { appToken: string; secretKey: string; webhookSecret?: string; baseUrl?: string; levelName?: string }) {
    this.appToken = options.appToken;
    this.secretKey = options.secretKey;
    this.webhookSecret = options.webhookSecret?.trim() || "";
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") || "https://api.sumsub.com";
    this.levelName = options.levelName || "basic-kyc-level";
  }

  isConfigured() {
    return Boolean(this.appToken && this.secretKey && this.webhookSecret);
  }

  async screenMerchant(input: ScreenMerchantInput): Promise<ComplianceResult> {
    if (!this.isConfigured()) return new NullComplianceProvider().screenMerchant(input);

    const path = `/resources/accessTokens?userId=${encodeURIComponent(input.merchantId)}&levelName=${encodeURIComponent(this.levelName)}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-App-Token": this.appToken,
        "X-App-Access-Sig": sumsubSignature(this.secretKey, timestamp, "POST", path, ""),
        "X-App-Access-Ts": timestamp,
      },
      body: "",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload?.token !== "string") throw new Error("Sumsub access token request failed");

    return {
      status: "pending",
      riskScore: null,
      providerRef: input.merchantId,
      webSdkToken: payload.token,
      message: "Sumsub screening is pending. Complete the hosted verification flow to continue.",
    };
  }

  getWebhookSecret() {
    return this.webhookSecret;
  }
}

export function getComplianceProvider(): ComplianceProvider {
  const configured = (process.env.COMPLIANCE_PROVIDER || (process.env.NODE_ENV === "production" ? "null" : "demo")).trim().toLowerCase();
  if (configured === "demo") return process.env.NODE_ENV === "production" ? new NullComplianceProvider() : new DemoComplianceProvider();
  if (configured === "sumsub") {
    const provider = new SumsubComplianceProvider({
      appToken: process.env.SUMSUB_APP_TOKEN?.trim() || "",
      secretKey: process.env.SUMSUB_SECRET_KEY?.trim() || "",
      webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET?.trim(),
      baseUrl: process.env.SUMSUB_API_URL,
      levelName: process.env.SUMSUB_LEVEL_NAME,
    });
    return provider.isConfigured() ? provider : new NullComplianceProvider();
  }
  return new NullComplianceProvider();
}

export function getComplianceProviderName(): ComplianceProviderName {
  return getComplianceProvider().name;
}