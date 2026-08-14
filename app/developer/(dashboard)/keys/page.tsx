"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession } from "@/lib/crypto/session";
import { useEnvironment } from "@/lib/context/EnvironmentContext";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  Key,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Wallet,
  Check,
  AlertCircle,
  Upload,
  Building2,
  Lock,
  Unlock,
  Image as ImageIcon,
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  publishable: string;
  secret?: string;
  createdAt: string;
  lastUsed: string;
  environment?: "mainnet" | "devnet";
}

function generateSecureId(length = 16) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, length);
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isSandbox } = useEnvironment();

  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const [isEmailReadOnly, setIsEmailReadOnly] = useState(true);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadData = async () => {
      const localEmail =
        window.localStorage.getItem("merchant_email") ||
        window.localStorage.getItem("email") ||
        "";
      const localName = window.localStorage.getItem("merchant_name") || "";
      const localLogo = window.localStorage.getItem("merchant_logo") || "";
      const localSecondary = window.localStorage.getItem("secondary_email") || "";
      const localWallet = window.localStorage.getItem("settlement_wallet_address") || "";
      const localWebsite = window.localStorage.getItem("website_url") || "";
      const localWebhook = window.localStorage.getItem("webhook_url") || "";

      if (localEmail) setMerchantEmail(localEmail);
      if (localName) setMerchantName(localName);
      if (localLogo) setMerchantLogo(localLogo);
      if (localSecondary) setSecondaryEmail(localSecondary);
      if (localWallet) setSettlementWalletAddress(localWallet);
      if (localWebsite) setWebsiteUrl(localWebsite);
      if (localWebhook) setWebhookUrl(localWebhook);

      const cachedKeys = window.localStorage.getItem("opayque_api_keys");
      if (cachedKeys) {
        try {
          setKeyPairs(JSON.parse(cachedKeys));
        } catch (e) {
          console.warn("Failed to parse cached keys", e);
        }
      }

      try {
        const [merchantRes, keysRes] = await Promise.all([
          fetch("/api/v1/merchant").catch(() => null),
          fetch("/api/v1/keys").catch(() => null),
        ]);

        if (merchantRes?.ok) {
          const payload = await merchantRes.json();
          const merchant = payload?.merchant;
          if (merchant) {
            if (merchant.email) setMerchantEmail(merchant.email);
            if (merchant.merchant_name) {
              setMerchantName(merchant.merchant_name);
              window.localStorage.setItem("merchant_name", merchant.merchant_name);
            }
            if (merchant.merchant_logo) {
              setMerchantLogo(merchant.merchant_logo);
              window.localStorage.setItem("merchant_logo", merchant.merchant_logo);
            }
            if (merchant.secondary_email) setSecondaryEmail(merchant.secondary_email);
            if (merchant.settlement_wallet_address)
              setSettlementWalletAddress(merchant.settlement_wallet_address);
            if (merchant.website_url) setWebsiteUrl(merchant.website_url);
            if (merchant.webhook_url) setWebhookUrl(merchant.webhook_url);
          }
        }

        if (keysRes?.ok) {
          const data = await keysRes.json();
          if (data.keys && Array.isArray(data.keys)) {
            const transformed: ApiKeyPair[] = data.keys.map((k: any) => ({
              id: k.id,
              publishable:
                k.publishableKey ||
                (k.prefix
                  ? `${k.prefix}pub_${k.id.slice(0, 8)}`
                  : `osk_pub_${k.id.slice(0, 8)}`),
              // Never trust secret from list endpoint in production
              secret: k.rawSecretKey || undefined,
              createdAt: k.created_at ?? new Date().toISOString(),
              lastUsed: k.last_used_at ? "recent" : "never",
              environment: k.environment || "mainnet",
            }));
            setKeyPairs(transformed);
            window.localStorage.setItem("opayque_api_keys", JSON.stringify(transformed));
          }
        }
      } catch (error) {
        console.warn("Backend API offline or unauthenticated. Using local cache.", error);
      } finally {
        setLoadingKeys(false);
      }
    };

    void loadData();
  }, []);

  const primaryEmailAvailable = Boolean(merchantEmail.trim());

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setMerchantLogo(result);
      window.localStorage.setItem("merchant_logo", result);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleVisibility = (id: string) => {
    setVisibleSecretId((current) => (current === id ? null : id));
  };

  const handleCopyKey = (id: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKeyId(id);
    window.setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    setProfileMessage(null);
    setProfileError(null);

    const targetEnv = isSandbox ? "devnet" : "mainnet";
    const envPrefix = isSandbox ? "osk_test_" : "osk_live_";

    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: targetEnv }),
      });

      if (res.ok) {
        const data = await res.json();
        const newKey: ApiKeyPair = {
          id: data.id || generateSecureId(12),
          publishable:
            data.publishableKey ||
            `${envPrefix}pub_${(data.id || generateSecureId(8)).slice(0, 8)}`,
          secret: data.rawSecretKey, // only available at creation
          createdAt: data.createdAt || new Date().toISOString(),
          lastUsed: "never",
          environment: targetEnv,
        };

        setKeyPairs((current) => {
          const updated = [newKey, ...current];
          window.localStorage.setItem("opayque_api_keys", JSON.stringify(updated));
          return updated;
        });

        setVisibleSecretId(newKey.id);
        setProfileMessage(
          `New ${targetEnv.toUpperCase()} key created. Copy the secret now — it will not be shown again.`
        );
        return;
      }
    } catch (error) {
      console.warn("API offline, generating key locally", error);
    }

    // Local fallback
    const randomId = generateSecureId(12);
    const newKey: ApiKeyPair = {
      id: randomId,
      publishable: `${envPrefix}pub_${randomId.slice(0, 8)}`,
      secret: `${envPrefix}sec_${generateSecureId(24)}`,
      createdAt: new Date().toISOString(),
      lastUsed: "never",
      environment: targetEnv,
    };

    setKeyPairs((current) => {
      const updated = [newKey, ...current];
      window.localStorage.setItem("opayque_api_keys", JSON.stringify(updated));
      return updated;
    });

    setVisibleSecretId(newKey.id);
    setProfileMessage(
      `New ${targetEnv.toUpperCase()} key generated locally. Copy the secret now.`
    );
    setCreatingKey(false);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    window.localStorage.setItem("merchant_email", merchantEmail.trim());
    window.localStorage.setItem("merchant_name", merchantName.trim());
    window.localStorage.setItem("merchant_logo", merchantLogo.trim());
    window.localStorage.setItem("secondary_email", secondaryEmail.trim());
    window.localStorage.setItem(
      "settlement_wallet_address",
      settlementWalletAddress.trim()
    );
    window.localStorage.setItem("website_url", websiteUrl.trim());
    window.localStorage.setItem("webhook_url", webhookUrl.trim());

    try {
      const res = await fetch("/api/v1/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: merchantEmail.trim() || null,
          merchantName: merchantName.trim() || null,
          merchantLogo: merchantLogo.trim() || null,
          secondaryEmail: secondaryEmail.trim() || null,
          settlementWalletAddress: settlementWalletAddress.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
          webhookUrl: webhookUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Unable to save merchant details");
      }

      setProfileMessage("Merchant details updated successfully.");
    } catch (error: any) {
      console.warn("API update failed; saved to local cache", error);
      setProfileMessage("Merchant details saved locally.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendAccessNotification = async () => {
    setSendingNotification(true);
    setNotificationMessage(null);
    setNotificationError(null);

    try {
      const res = await fetch("/api/v1/merchant/notify", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send notification");
      }
      const body = await res.json();
      setNotificationMessage(body?.message || "Access notification sent.");
    } catch (error: any) {
      setNotificationError(error?.message || "Unable to send access notification.");
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign-out failed", error);
    }

    clearActiveSession();
    window.localStorage.removeItem("merchant_name");
    window.localStorage.removeItem("merchant_logo");
    window.localStorage.removeItem("merchant_email");
    window.localStorage.removeItem("developer_environment");
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden text-white">
      {/* Keep your existing full UI from here downward — it is already good */}
      {/* ... (rest of your original beautiful JSX remains the same) */}
    </main>
  );
}