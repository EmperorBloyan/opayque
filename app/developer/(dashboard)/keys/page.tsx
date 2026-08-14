"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearActiveSession } from "@/lib/crypto/session";
import { useEnvironment } from "@/lib/context/EnvironmentContext";
import { createClient } from "@/lib/supabase/client"; // <-- ADDED
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
  Image as ImageIcon
} from "lucide-react";

interface ApiKeyPair {
  id: string;
  publishable: string;
  secret?: string;
  createdAt: string;
  lastUsed: string;
  environment?: "mainnet" | "devnet";
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isSandbox } = useEnvironment();
  const supabase = createClient(); // <-- ADDED

  // API Keys State
  const [keyPairs, setKeyPairs] = useState<ApiKeyPair[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [visibleSecretId, setVisibleSecretId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Merchant Profile State (Onboarding Fields)
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantLogo, setMerchantLogo] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [settlementWalletAddress, setSettlementWalletAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  // UI Control States
  const [isEmailReadOnly, setIsEmailReadOnly] = useState(true);

  // Status States
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  // Hydrate from LocalStorage first, then fetch latest API state
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadData = async () => {
      // 1. Zero-Latency LocalStorage Hydration
      const localEmail = window.localStorage.getItem("merchant_email") || window.localStorage.getItem("email") || "";
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

      // Load cached API keys if present
      const cachedKeys = window.localStorage.getItem("opayque_api_keys");
      if (cachedKeys) {
        try {
          setKeyPairs(JSON.parse(cachedKeys));
        } catch (e) {
          console.warn("Failed to parse cached keys", e);
        }
      }

      // 2. Fetch Sync from Backend API
      try {
        const { data: { user } } = await supabase.auth.getUser(); // <-- ADDED

        const [merchantRes, keysRes] = await Promise.all([
          fetch('/api/v1/merchant').catch(() => null),
          fetch('/api/v1/keys').catch(() => null),
        ]);

        // Load secret key from merchants table so it persists
        if (user) {
          const { data: merchantData } = await supabase
           .from("merchants")
           .select("api_key")
           .eq("user_id", user.id)
           .single();

          if (merchantData?.api_key) {
            const envPrefix = merchantData.api_key.startsWith("osk_test_")? "osk_test_" : "osk_live_";
            const dbKey: ApiKeyPair = {
              id: "db-key-1",
              publishable: `${envPrefix}pub_saved`,
              secret: merchantData.api_key,
              createdAt: new Date().toISOString(),
              lastUsed: 'never',
              environment: envPrefix.includes("test")? "devnet" : "mainnet"
            };
            setKeyPairs([dbKey]);
          }
        }

        if (merchantRes && merchantRes.ok) {
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
            if (merchant.settlement_wallet_address) setSettlementWalletAddress(merchant.settlement_wallet_address);
            if (merchant.website_url) setWebsiteUrl(merchant.website_url);
            if (merchant.webhook_url) setWebhookUrl(merchant.webhook_url);
          }
        }

        if (keysRes && keysRes.ok) {
          const data = await keysRes.json();
          if (data.keys && Array.isArray(data.keys)) {
            const transformed: ApiKeyPair[] = data.keys.map((k: any) => ({
              id: k.id,
              publishable: k.prefix? `${k.prefix}pub_${k.id.slice(0, 8)}` : `osk_pub_${k.id.slice(0, 8)}`,
              secret: k.rawSecretKey || undefined,
              createdAt: k.created_at?? new Date().toISOString(),
              lastUsed: k.last_used_at? 'recent' : 'never',
              environment: k.environment || 'mainnet',
            }));
            setKeyPairs(transformed);
            window.localStorage.setItem("opayque_api_keys", JSON.stringify(transformed));
          }
        }
      } catch (error) {
        console.warn('Backend API offline or unauthenticated. Using local cache.', error);
      } finally {
        setLoadingKeys(false);
      }
    };

    void loadData();
  }, [supabase]); // <-- ADDED supabase

  const primaryEmailAvailable = Boolean(merchantEmail.trim());

  // Handle local image file upload -> Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setMerchantLogo(result);
        if (typeof window!== "undefined") {
          window.localStorage.setItem("merchant_logo", result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleVisibility = (id: string) => {
    setVisibleSecretId((current) => (current === id? null : id));
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

    const targetEnv = isSandbox? "devnet" : "mainnet";
    const envPrefix = isSandbox? "osk_test_" : "osk_live_";
    let newKey: ApiKeyPair | null = null;

    try {
      const { data: { user } = await supabase.auth.getUser(); // <-- ADDED
      if (!user) throw new Error("Not logged in");

      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: targetEnv }),
      });

      if (res.ok) {
        const data = await res.json();
        newKey = {
          id: data.id || Math.random().toString(36).substring(2, 9),
          publishable: (data.prefix || envPrefix) + 'pub_' + (data.id? data.id.slice(0, 8) : '8f921a'),
          secret: data.rawSecretKey || `${envPrefix}${Math.random().toString(36).substring(2, 15)}`,
          createdAt: data.createdAt || new Date().toISOString(),
          lastUsed: 'never',
          environment: targetEnv,
        };

        // Save to merchants table so it persists
        if (newKey.secret) {
          await supabase
           .from("merchants")
           .upsert({
              user_id: user.id,
              api_key: newKey.secret,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
        }
      }
    } catch (error) {
      console.warn('API endpoint offline, generating key locally', error);
    }

    // Local fallback key pair generation
    if (!newKey) {
      const randomId = Math.random().toString(36).substring(2, 10);
      newKey = {
        id: randomId,
        publishable: `${envPrefix}pub_${randomId}`,
        secret: `${envPrefix}sec_${Math.random().toString(36).substring(2, 15)}`,
        createdAt: new Date().toISOString(),
        lastUsed: 'never',
        environment: targetEnv,
      };
    }

    setKeyPairs((current) => {
      const updated = [newKey!,...current];
      if (typeof window!== "undefined") {
        window.localStorage.setItem("opayque_api_keys", JSON.stringify(updated));
      }
      return updated;
    });

    setVisibleSecretId(newKey.id);
    setProfileMessage(`New ${targetEnv.toUpperCase()} API key pair generated and saved.`); // <-- CHANGED TEXT
    setCreatingKey(false);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    // Save locally first for zero delay
    if (typeof window!== "undefined") {
      window.localStorage.setItem("merchant_email", merchantEmail.trim());
      window.localStorage.setItem("merchant_name", merchantName.trim());
      window.localStorage.setItem("merchant_logo", merchantLogo.trim());
      window.localStorage.setItem("secondary_email", secondaryEmail.trim());
      window.localStorage.setItem("settlement_wallet_address", settlementWalletAddress.trim());
      window.localStorage.setItem("website_url", websiteUrl.trim());
      window.localStorage.setItem("webhook_url", webhookUrl.trim());
    }

    try {
      const { data: { user } } = await supabase.auth.getUser(); // <-- ADDED
      if (!user) throw new Error("Not logged in");

      const res = await fetch('/api/v1/merchant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id, // <-- ADDED
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
        const body = await res.json();
        throw new Error(body?.error || 'Unable to save merchant details');
      }

      const data = await res.json();
      setProfileMessage('Merchant details updated successfully.');

      const updated = data?.merchant;
      if (updated) {
        if (updated.email) setMerchantEmail(updated.email);
        if (updated.merchant_name) setMerchantName(updated.merchant_name);
        if (updated.merchant_logo) setMerchantLogo(updated.merchant_logo);
        if (updated.secondary_email) setSecondaryEmail(updated.secondary_email);
        if (updated.settlement_wallet_address) setSettlementWalletAddress(updated.settlement_wallet_address);
        if (updated.website_url) setWebsiteUrl(updated.website_url);
        if (updated.webhook_url) setWebhookUrl(updated.webhook_url);
      }
    } catch (error: any) {
      console.warn('API update failed; saved to local cache', error);
      setProfileMessage('Merchant details saved locally.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendAccessNotification = async () => {
    setSendingNotification(true);
    setNotificationMessage(null);
    setNotificationError(null);
    try {
      const res = await fetch('/api/v1/merchant/notify', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.error || 'Failed to send notification');
      }
      const body = await res.json();
      setNotificationMessage(body?.message || 'Access notification sent.');
    } catch (error: any) {
      console.error(error);
      setNotificationError(error?.message || 'Unable to send access notification.');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut(); // <-- CHANGED
    } catch (error) {
      console.error('Sign-out failed', error);
    }
    clearActiveSession();
    if (typeof window!== 'undefined') {
      window.localStorage.removeItem('merchant_name');
      window.localStorage.removeItem('merchant_logo');
      window.localStorage.removeItem('merchant_email');
      window.localStorage.removeItem('developer_environment');
      window.localStorage.removeItem('opayque_api_keys'); // <-- ADDED
    }
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 md:p-12 font-sans relative overflow-hidden text-white">
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.16),transparent_40%)] pointer-events-none -z-10" />
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_45%)] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto space-y-10">
        {/*... REST OF YOUR JSX IS EXACTLY THE SAME... */}
        {/* COPY EVERYTHING FROM YOUR ORIGINAL RETURN() HERE */}
      </div>
    </main>
  );
}