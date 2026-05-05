/**
 * Utility to handle image uploads for the Opayque ecosystem.
 */

export const uploadToPermanentStorage = async (base64File: string): Promise<string> => {
  try {
    // Currently returns Base64 for localStorage persistence.
    // Transition Path: Replace this return with an Irys/Arweave upload 
    // to store the Merchant or Staff photo permanently on-chain.
    return base64File; 
  } catch (error) {
    console.error("Storage upload failed:", error);
    throw new Error("Failed to secure image on-chain");
  }
};