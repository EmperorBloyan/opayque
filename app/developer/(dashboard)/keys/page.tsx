"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  Save, 
  ShieldCheck, 
  Lock, 
  Mail, 
  Building, 
  Wallet,
  AlertCircle
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function KeysAndDetailsPage() {
  // Merchant details state
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [settlementWallet, setSettlementWallet] = useState("");
  const [isEditableEmail, setIsEditableEmail] = useState(true);

  // API keys state
  const [liveKey, setLiveKey] = useState<string | null>(null);
  const [testKey, setTestKey] = useState<string | null>(null);

  // Loading & Feedback states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Fetch saved merchant info and keys on page load
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch merchant details
        const { data: merchant, error: merchantErr } = await supabase
          .from("merchant_details")
          .select("*")
          .eq("merchant_id", "default_merchant")
          .single();

        if (merchant) {
          setBusinessName(merchant.business_name || "");
          setEmail(merchant.email || "");
          setSettlementWallet(merchant.settlement_wallet || "");
        }

        // Fetch API keys
        const { data: keys } = await supabase
          .from("api_keys")
          .select("*")
          .eq("merchant_id", "default_merchant");

        if (keys && keys.length > 0) {
          const live = keys.find((k) => k.key_type === "live")?.api_key;
          const test = keys.find((k) => k.key_type === "test")?.api_key;
          if (live) setLiveKey(live);
          if (test) setTestKey(test);
        }
      } catch (err: any) {
        console.error("Error loading data:", err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 2. Save/Update Merchant Details to Supabase
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("merchant_details").upsert(
        {
          merchant_id: "default_merchant",
          business_name: businessName,
          email: email,
          settlement_wallet: settlementWallet,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );

      if (error) throw error;

      setMessage({ type: "success", text: "Merchant details saved successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: `Failed to save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // 3. Generate new API key and persist to Supabase
  const handleGenerateKey = async (type: "live" | "test") => {
    setGenerating(true);
    setMessage(null);

    try {
      const randomBytes = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const newKey = `osk_${type}_${randomBytes}`;

      const { error } = await supabase.from("api_keys").upsert(
        {
          merchant_id: "default_merchant",
          key_type: type,
          api_key: newKey,
          created_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id,key_type" }
      );

      if (error) {
        // Fallback insert if unique constraint differs
        await supabase.from("api_keys").insert({
          merchant_id: "default_merchant",
          key_type: type,
          api_key: newKey,
        });
      }

      if (type === "live") setLiveKey(newKey);
      else setTestKey(newKey);

      setMessage({ type: "success", text: `New ${type.toUpperCase()} API Key generated!` });
    } catch (err: any) {
      setMessage({ type: "error", text: `Unable to generate key: ${err.message}` });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <RefreshCw size={24} className="animate-spin text-purple-500 mr-2" /> Loading Merchant Config...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-10 animate-in fade-in duration-500">
      <header className="border-b border-white/5 pb-6">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
          API Keys &amp; Merchant Details
        </h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-500">
          Manage your credentials, operational profile, and payout addresses.
        </p>
      </header>

      {/* Notification Banner */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
          message.type === "success" ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-400" : "bg-red-950/40 border border-red-500/30 text-red-400"
        }`}>
          <AlertCircle size={16} />
          {message.text}
        </div>
      )}

      {/* SECTION 1: API Keys */}
      <section className="space-y-6 rounded-[2.5rem] border border-white/10 bg-zinc-950/80 p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Key size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider text-white">Authentication Keys</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Secret keys for signing backend API requests</p>
            </div>
          </div>

          <button
            onClick={() => handleGenerateKey("live")}
            disabled={generating}
            className="flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-50 transition"
          >
            <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : "Generate New Key"}
          </button>
        </div>

        <div className="space-y-4">
          {/* Live Key */}
          <div className="rounded-2xl border border-white/10 bg-black/60 p-4 space-y-2">
            <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-zinc-400">
              <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck size={12} /> Live Secret Key</span>
              <span>Production</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-white tracking-wider">
                {liveKey ? liveKey : "No key generated yet. Click generate above."}
              </code>
              {liveKey && (
                <button
                  onClick={() => copyToClipboard(liveKey)}
                  className="text-zinc-400 hover:text-white shrink-0 p-1"
                >
                  {copiedKey === liveKey ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Merchant Details */}
      <section className="space-y-6 rounded-[2.5rem] border border-white/10 bg-zinc-950/80 p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Building size={18} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider text-white">Merchant Profile</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Saved details from onboarding</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditableEmail(!isEditableEmail)}
            className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 flex items-center gap-1"
          >
            <Lock size={12} /> {isEditableEmail ? "Lock Fields" : "Unlock Fields"}
          </button>
        </div>

        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1">
              <Building size={12} /> Business / App Name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Opayque Pay"
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1">
              <Mail size={12} /> Contact Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isEditableEmail}
              placeholder="merchant@example.com"
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs text-white focus:border-purple-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1">
              <Wallet size={12} /> Solana Settlement Wallet Address
            </label>
            <input
              type="text"
              value={settlementWallet}
              onChange={(e) => setSettlementWallet(e.target.value)}
              placeholder="e.g. 7xKXtg...3b9Y"
              className="w-full rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-xs font-mono text-emerald-400 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-purple-600 py-3.5 text-xs font-black uppercase tracking-widest text-white hover:bg-purple-500 transition disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving Changes..." : "Save Merchant Info"}
          </button>
        </form>
      </section>
    </div>
  );
}
