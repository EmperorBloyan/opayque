import { z } from "zod";

const optionalUrl = z.string().trim().url().optional();

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(["mainnet-beta", "testnet", "devnet"]).default("devnet"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_RPC_URL: optionalUrl,
  NEXT_PUBLIC_SOLANA_RPC_URL: optionalUrl,
  NEXT_PUBLIC_SOLANA_RPC_FALLBACK_URL: optionalUrl,
  NEXT_PUBLIC_MAGICBLOCK_API: optionalUrl,
  MAGICBLOCK_API_KEY: z.string().trim().min(1).optional(),
  RELAYER_PRIVATE_KEY: z.string().trim().min(1).optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_OPAYQUE_PROGRAM_ID: z.string().trim().min(1).optional(),
  COMPLIANCE_PROVIDER: z.enum(["null", "demo", "sumsub"]).optional(),
  SUMSUB_APP_TOKEN: z.string().trim().min(1).optional(),
  SUMSUB_SECRET_KEY: z.string().trim().min(1).optional(),
  SUMSUB_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  SOLANA_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
  WEBHOOK_ENCRYPTION_KEY: z.string().trim().min(1).optional(),
  WEBHOOK_DELIVERY_SECRET: z.string().trim().min(1).optional(),
  CRON_SECRET: z.string().trim().min(1).optional(),
  BRIDGE_API_URL: optionalUrl,
  BRIDGE_API_KEY: z.string().trim().min(1).optional(),
  BRIDGE_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
}).passthrough();

export type EnvironmentName = "development" | "test" | "production";
export type EnvironmentStatus = "configured" | "optional" | "missing" | "invalid";

export interface EnvironmentIssue {
  key: string;
  message: string;
  severity: "warning" | "error";
}

export interface EnvironmentValidation {
  ok: boolean;
  environment: EnvironmentName;
  network: string;
  issues: EnvironmentIssue[];
  configured: Record<string, EnvironmentStatus>;
}

const secretKeys = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "MAGICBLOCK_API_KEY",
  "RELAYER_PRIVATE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "SOLANA_WEBHOOK_SECRET",
  "WEBHOOK_ENCRYPTION_KEY",
  "WEBHOOK_DELIVERY_SECRET",
]);

const hasValue = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

export function validateEnvironment(input: NodeJS.ProcessEnv = process.env): EnvironmentValidation {
  const parsed = environmentSchema.safeParse(input);
  const vercelEnv = input.VERCEL_ENV || input.NEXT_PUBLIC_VERCEL_ENV;
  const isPreview = vercelEnv === "preview";
  const isStrictProduction = input.NODE_ENV === "production" && !isPreview;
  const environment: EnvironmentName = input.NODE_ENV === "production"
    ? "production"
    : input.NODE_ENV === "test"
      ? "test"
      : "development";
  const network = input.NEXT_PUBLIC_SOLANA_NETWORK?.trim() || "devnet";
  const issues: EnvironmentIssue[] = [];
  const configured: Record<string, EnvironmentStatus> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "environment";
      configured[key] = "invalid";
      issues.push({ key, message: issue.message, severity: isStrictProduction ? "error" : "warning" });
    }
  }

  const requiredInProduction = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_RPC_URL",
    "NEXT_PUBLIC_MAGICBLOCK_API",
    "MAGICBLOCK_API_KEY",
    "RELAYER_PRIVATE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "WEBHOOK_ENCRYPTION_KEY",
    "WEBHOOK_DELIVERY_SECRET",
    "CRON_SECRET",
    "SOLANA_WEBHOOK_SECRET",
    "NEXT_PUBLIC_OPAYQUE_PROGRAM_ID",
  ]);

  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_RPC_URL",
    "NEXT_PUBLIC_SOLANA_RPC_URL",
    "NEXT_PUBLIC_SOLANA_RPC_FALLBACK_URL",
    "NEXT_PUBLIC_MAGICBLOCK_API",
    "MAGICBLOCK_API_KEY",
    "RELAYER_PRIVATE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "NEXT_PUBLIC_OPAYQUE_PROGRAM_ID",
    "WEBHOOK_ENCRYPTION_KEY",
    "WEBHOOK_DELIVERY_SECRET",
    "CRON_SECRET",
    "SOLANA_WEBHOOK_SECRET",
  ];

  for (const key of keys) {
    if (configured[key] === "invalid") continue;
    if (hasValue(input[key])) {
      configured[key] = "configured";
      continue;
    }
    const required = isStrictProduction && requiredInProduction.has(key);
    configured[key] = required ? "missing" : "optional";
    if (required) {
      issues.push({ key, message: `${key} is required in production`, severity: "error" });
    }
  }

  if (isStrictProduction && network !== "mainnet-beta") {
    issues.push({ key: "NEXT_PUBLIC_SOLANA_NETWORK", message: "Production must use mainnet-beta", severity: "error" });
  }

  if (input.COMPLIANCE_PROVIDER === "sumsub") {
    for (const key of ["SUMSUB_APP_TOKEN", "SUMSUB_SECRET_KEY", "SUMSUB_WEBHOOK_SECRET"] as const) {
      if (!hasValue(input[key])) issues.push({ key, message: `${key} is required when COMPLIANCE_PROVIDER=sumsub`, severity: isStrictProduction ? "error" : "warning" });
    }
  }

  if (hasValue(input.BRIDGE_API_KEY) && !hasValue(input.BRIDGE_WEBHOOK_SECRET)) {
    issues.push({ key: "BRIDGE_WEBHOOK_SECRET", message: "BRIDGE_WEBHOOK_SECRET is required when Bridge payouts are enabled", severity: isStrictProduction ? "error" : "warning" });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    environment,
    network,
    issues,
    configured,
  };
}

export function assertEnvironment(input: NodeJS.ProcessEnv = process.env): void {
  const result = validateEnvironment(input);
  const errors = result.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Environment configuration is incomplete: ${errors.map((issue) => `${issue.key}: ${issue.message}`).join("; ")}`);
  }
}

export function getSafeEnvironmentSummary(input: NodeJS.ProcessEnv = process.env) {
  const result = validateEnvironment(input);
  return {
    environment: result.environment,
    network: result.network,
    configured: Object.fromEntries(Object.entries(result.configured).filter(([key]) => !secretKeys.has(key))),
    issues: result.issues,
  };
}
