// lib/types.ts

/**
 * Represents a registered recipient in the Opayque ecosystem.
 */
export interface Endpoint {
  id: string;
  name: string;
  address: string;
  category: "Staff" | "Cause" | "Tips";
  image?: string;
  createdAt: number;
}

/**
 * Represents a paired hardware terminal in the fleet.
 */
export interface Terminal {
  id: string;
  label: string;
  status: "online" | "offline";
  lastSeen: number;
  accessCode?: string;
  isActive?: boolean;
  lastLoginAt?: number | null;
}

/**
 * Represents the client-side state of the merchant vault authorization flow.
 */
export interface VaultAuthState {
  status: "idle" | "authorizing" | "authenticated" | "error";
  message: string | null;
}

export type EndpointCategory = "Staff" | "Cause" | "Tips";