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
 * Represents a piece of TEE-enabled hardware in the fleet.
 */
export interface Terminal {
  id: string;
  label: string;
  status: 'online' | 'offline';
  lastSeen: number;
}

export type EndpointCategory = "Staff" | "Cause" | "Tips";