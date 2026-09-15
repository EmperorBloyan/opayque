export interface TerminalSession {
  id: string;
  merchantId: string;
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  walletSignature: string;
  publicKeyJwk: JsonWebKey;
  sessionKeyPair: CryptoKeyPair;
  sign: (message: ArrayBuffer | Uint8Array | string) => Promise<Uint8Array>;
  verify: (message: ArrayBuffer | Uint8Array | string, signature: ArrayBuffer | Uint8Array) => Promise<boolean>;
}

export interface SessionChallenge {
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface CreateTerminalSessionInput {
  merchantId: string;
  walletAddress: string;
  nonce: string;
  walletSignature: ArrayBuffer | Uint8Array;
}

export interface TerminalDeviceCredential {
  terminalId: string;
  merchantId: string;
  deviceToken: string;
  merchantWallet: string;
  pairedAt: number;
}

let activeSession: TerminalSession | null = null;
const ACTIVE_MERCHANT_ID_KEY = "opayque.activeMerchantId";
const ACTIVE_SESSION_KEY = "opayque.activeSession";
const TERMINAL_DEVICE_KEY = "opayque.device";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeMessage(message: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof message === "string") {
    return encoder.encode(message);
  }

  if (message instanceof ArrayBuffer) {
    return new Uint8Array(message);
  }

  const view = message as Uint8Array;
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";

  buffer.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return globalThis.btoa(binary);
}

function createSessionId(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  return `session-${Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function createSessionChallenge(): SessionChallenge {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return {
    nonce,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

export async function createTerminalSession(input: CreateTerminalSessionInput): Promise<TerminalSession> {
  const sessionKeyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", sessionKeyPair.publicKey) as JsonWebKey;

  const session: TerminalSession = {
    id: createSessionId(),
    merchantId: input.merchantId,
    walletAddress: input.walletAddress,
    nonce: input.nonce,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
    walletSignature: bytesToBase64(input.walletSignature),
    publicKeyJwk,
    sessionKeyPair,
    sign: async (message) => {
      const bytes = normalizeMessage(message);
      const messageBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const signature = await crypto.subtle.sign(
        {
          name: "ECDSA",
          hash: "SHA-256",
        },
        sessionKeyPair.privateKey,
        messageBuffer
      );

      return new Uint8Array(signature);
    },
    verify: async (message, signature) => {
      const bytes = normalizeMessage(message);
      const normalizedSignature = signature instanceof ArrayBuffer
        ? signature
        : (() => {
            const view = signature as Uint8Array;
            return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
          })();

      const signatureBytes = new Uint8Array(normalizedSignature instanceof ArrayBuffer ? normalizedSignature : normalizedSignature.slice(0));
      const messageBytes = new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const signatureBuffer = signatureBytes.buffer as ArrayBuffer;
      const messageBuffer = messageBytes.buffer as ArrayBuffer;

      return crypto.subtle.verify(
        {
          name: "ECDSA",
          hash: "SHA-256",
        },
        sessionKeyPair.publicKey,
        signatureBuffer,
        messageBuffer
      );
    },
  };

  return setActiveSession(session);
}

export function setActiveSession(session: TerminalSession): TerminalSession {
  activeSession = session;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_MERCHANT_ID_KEY, session.merchantId);
    window.localStorage.setItem(ACTIVE_SESSION_KEY, serializeSession(session));
  }
  return session;
}

export function getActiveSession(): TerminalSession | null {
  if (!activeSession && typeof window !== "undefined") {
    const serialized = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (serialized) {
      const restored = deserializeSession(serialized);
      if (restored) {
        activeSession = restored;
      }
    }
  }

  if (!activeSession) {
    return null;
  }

  if (activeSession.expiresAt <= Date.now()) {
    clearActiveSession();
    return null;
  }

  return activeSession;
}

export function clearActiveSession(): void {
  activeSession = null;
  if (typeof window !== "undefined") {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("opayque") && key !== TERMINAL_DEVICE_KEY) {
        window.localStorage.removeItem(key);
      }
    }
  }
}

export function saveTerminalDeviceCredential(credential: TerminalDeviceCredential): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TERMINAL_DEVICE_KEY, JSON.stringify(credential));
}

export function loadTerminalDeviceCredential(): TerminalDeviceCredential | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TERMINAL_DEVICE_KEY);
    if (!raw) return null;
    const credential = JSON.parse(raw) as Partial<TerminalDeviceCredential>;
    if (
      typeof credential.terminalId !== "string" ||
      typeof credential.merchantId !== "string" ||
      typeof credential.deviceToken !== "string" ||
      typeof credential.merchantWallet !== "string"
    ) {
      return null;
    }
    return credential as TerminalDeviceCredential;
  } catch {
    return null;
  }
}

export function clearTerminalDeviceCredential(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TERMINAL_DEVICE_KEY);
  }
}

export function setActiveMerchantId(merchantId: string): void {
  if (!merchantId || merchantId === "merchant-vault") return;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_MERCHANT_ID_KEY, merchantId);
  }

  // Keep in-memory session merchant id in sync if present
  if (activeSession) {
    activeSession = {
      ...activeSession,
      merchantId,
    };
  }
}

export function bindAuthenticatedMerchantSession(input: {
  merchantId: string;
  walletAddress?: string | null;
}): void {
  const merchantId = input.merchantId?.trim();
  if (!merchantId || merchantId === "merchant-vault") return;

  setActiveMerchantId(merchantId);

  // Lightweight non-wallet session marker so vault pages treat user as authorized
  if (typeof window !== "undefined") {
    const existing = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!existing) {
      const now = Date.now();
      window.localStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify({
          id: `auth-session-${merchantId.slice(0, 8)}`,
          merchantId,
          walletAddress: input.walletAddress || "email-auth",
          nonce: `auth-${now}`,
          issuedAt: now,
          expiresAt: now + 12 * 60 * 60 * 1000, // 12h
          walletSignature: "",
          publicKeyJwk: {},
        })
      );
    }
  }
}

export function getStoredMerchantId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedMerchantId = window.localStorage.getItem(ACTIVE_MERCHANT_ID_KEY)?.trim();
  if (!storedMerchantId || storedMerchantId === "merchant-vault") {
    return null;
  }

  return storedMerchantId;
}

export function getActiveMerchantId(): string {
  if (activeSession?.merchantId) {
    return activeSession.merchantId;
  }

  const storedMerchantId = getStoredMerchantId();
  if (storedMerchantId) {
    return storedMerchantId;
  }

  return "merchant-vault";
}

export function isSessionActive(): boolean {
  return getActiveSession() !== null;
}

export function serializeSession(session: TerminalSession): string {
  return JSON.stringify({
    id: session.id,
    merchantId: session.merchantId,
    walletAddress: session.walletAddress,
    nonce: session.nonce,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    walletSignature: session.walletSignature,
    publicKeyJwk: session.publicKeyJwk,
  });
}

export function deserializeSession(serialized: string): TerminalSession | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<TerminalSession> & {
      publicKeyJwk?: JsonWebKey;
      walletSignature?: string;
      nonce?: string;
      merchantId?: string;
      walletAddress?: string;
      issuedAt?: number;
      expiresAt?: number;
      id?: string;
    };

    if (!parsed.id || !parsed.publicKeyJwk || !parsed.nonce || !parsed.merchantId || !parsed.walletAddress) {
      return null;
    }

    if (parsed.expiresAt && parsed.expiresAt <= Date.now()) {
      return null;
    }

    return {
      id: parsed.id,
      merchantId: parsed.merchantId,
      walletAddress: parsed.walletAddress,
      nonce: parsed.nonce,
      issuedAt: parsed.issuedAt ?? Date.now(),
      expiresAt: parsed.expiresAt ?? Date.now() + 15 * 60 * 1000,
      walletSignature: parsed.walletSignature ?? "",
      publicKeyJwk: parsed.publicKeyJwk,
      sessionKeyPair: {} as CryptoKeyPair,
      sign: async () => new Uint8Array(),
      verify: async () => false,
    };
  } catch {
    return null;
  }
}
