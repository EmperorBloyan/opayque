import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";

// TODO: Uncomment and point to your real IDL once ready
// import idl from "@/anchor/target/idl/opayque.json";
// import { Opayque } from "@/types/opayque";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const RELAYER_SECRET = process.env.RELAYER_PRIVATE_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { merchantPublicKey } = body;

    if (!merchantPublicKey) {
      return NextResponse.json(
        { success: false, error: "Missing merchantPublicKey" },
        { status: 400 }
      );
    }

    if (!RELAYER_SECRET) {
      return NextResponse.json(
        { success: false, error: "Relayer private key not configured" },
        { status: 500 }
      );
    }

    // Parse the relayer key
    let relayerKeypair: Keypair;
    try {
      const secretKey = Uint8Array.from(JSON.parse(RELAYER_SECRET));
      relayerKeypair = Keypair.fromSecretKey(secretKey);
    } catch (err) {
      console.error("Failed to parse RELAYER_PRIVATE_KEY", err);
      return NextResponse.json(
        { success: false, error: "Invalid relayer key format" },
        { status: 500 }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");

    // Create a wallet adapter for the relayer
    const wallet = {
      publicKey: relayerKeypair.publicKey,
      signTransaction: async (tx: Transaction) => {
        tx.partialSign(relayerKeypair);
        return tx;
      },
      signAllTransactions: async (txs: Transaction[]) => {
        return txs.map((tx) => {
          tx.partialSign(relayerKeypair);
          return tx;
        });
      },
    } as Wallet;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });

    // ============================================
    // TODO: Replace this section with your real
    // confidential account setup instruction
    // ============================================
    // Example structure (adjust to your actual program):
    //
    // const program = new Program(idl as any, provider);
    //
    // const tx = await program.methods
    //   .initializeConfidentialAccount() // or whatever your instruction is called
    //   .accounts({
    //     merchant: new PublicKey(merchantPublicKey),
    //     // ... other required accounts
    //     payer: relayerKeypair.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .transaction();
    //
    // const signature = await connection.sendTransaction(tx, [relayerKeypair]);
    // await connection.confirmTransaction(signature, "confirmed");

    // Temporary success response while you wire the real instruction
    console.log("Relayer received request for merchant:", merchantPublicKey);

    return NextResponse.json({
      success: true,
      message: "Confidential account setup completed via relayer",
      merchant: merchantPublicKey,
      // signature: signature, // uncomment when real tx is ready
    });
  } catch (error: any) {
    console.error("Relayer setup-confidential error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to setup confidential account",
      },
      { status: 500 }
    );
  }
}