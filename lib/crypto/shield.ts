export interface ShieldedPayload {
  payloadId: string;
  merchantId: string;
  amount: string;
  reference: string;
  createdAt: number;
  iv: string;
  ciphertext: string;
  keyId: string;
}

export interface ShieldedPayloadMetadata {
  merchantId: string;
  amount: string;
  reference: string;
  createdAt: number;
}

export interface EncryptShieldedPayloadInput {
  merchantId: string;
  amount: string;
  reference: string;
  key: CryptoKey;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let binary = "";

  buffer.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function createShieldKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportShieldKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key) as Promise<JsonWebKey>;
}

export async function importShieldKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptShieldedPayload(input: EncryptShieldedPayloadInput): Promise<ShieldedPayload> {
  const payload: ShieldedPayloadMetadata = {
    merchantId: input.merchantId,
    amount: input.amount,
    reference: input.reference,
    createdAt: Date.now(),
  };

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
    },
    input.key,
    asArrayBuffer(plaintext)
  );

  return {
    payloadId: `payload-${Date.now()}`,
    merchantId: input.merchantId,
    amount: input.amount,
    reference: input.reference,
    createdAt: payload.createdAt,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    keyId: "session-key",
  };
}

export async function decryptShieldedPayload(payload: ShieldedPayload, key: CryptoKey): Promise<ShieldedPayloadMetadata> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
    },
    key,
    asArrayBuffer(ciphertext)
  );

  return JSON.parse(decoder.decode(plaintext) as string) as ShieldedPayloadMetadata;
}
