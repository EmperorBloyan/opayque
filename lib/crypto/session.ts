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

let activeSession: TerminalSession | null = null;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeMessage(message: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof message === "string") {
    return encoder.encode(message);
  }

  if (message instanceof ArrayBuffer) {
    return new Uint8Array(message);
  }

  return new Uint8Array(message);
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
      const signature = await crypto.subtle.sign(
        {
          name: "ECDSA",
          hash: "SHA-256",
        },
        sessionKeyPair.privateKey,
        bytes
      );

      return new Uint8Array(signature);
    },
    verify: async (message, signature) => {
      const bytes = normalizeMessage(message);
      const signatureBuffer = signature instanceof ArrayBuffer
        ? signature
        : signature.buffer.slice(signature.byteOffset, signature.byteOffset + signature.byteLength);

      return crypto.subtle.verify(
        {
          name: "ECDSA",
          hash: "SHA-256",
        },
        sessionKeyPair.publicKey,
        signatureBuffer,
        bytes
      );
    },
  };

  return setActiveSession(session);
}

export function setActiveSession(session: TerminalSession): TerminalSession {
  activeSession = session;
  return session;
}

export function getActiveSession(): TerminalSession | null {
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
