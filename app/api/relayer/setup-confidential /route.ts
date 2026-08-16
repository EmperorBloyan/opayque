import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";

// Make sure the IDL is available in your Next.js project
import idl from "@/anchor/target/idl/opayque.json"; // adjust path if needed

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const RELAYER_SECRET = process.env.RELAYER_PRIVATE_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { merchantPublicKey, feeBps = 0, tokenDecimals = 6 } = body;

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

    // Load relayer keypair
    const secretKey = Uint8Array.from(JSON.parse(RELAYER_SECRET));
    const relayerKeypair = Keypair.fromSecretKey(secretKey);

    const connection = new Connection(RPC_URL, "confirmed");
    const merchant = new PublicKey(merchantPublicKey);

    // Wallet adapter for the relayer
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
    });

    const program = new Program(idl as any, provider);

    // Derive PDAs
    const [merchantVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant_vault"), merchant.toBuffer()],
      program.programId
    );

    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("opayque_treasury"), merchant.toBuffer()],
      program.programId
    );

    const [protocolConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );

    // Build the transaction
    const tx = await program.methods
      .initializeMerchantVault(
        new (await import("@coral-xyz/anchor")).BN(feeBps),
        merchant,
        tokenDecimals
      )
      .accounts({
        merchantAuthority: merchant,          // the merchant wallet
        payer: relayerKeypair.publicKey,      // relayer pays the fees
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // Send with relayer as signer
    const signature = await connection.sendTransaction(tx, [relayerKeypair], {
      skipPreflight: false,
    });

    await connection.confirmTransaction(signature, "confirmed");

    return NextResponse.json({
      success: true,
      message: "Merchant vault initialized successfully",
      signature,
      merchantVault: merchantVaultPda.toBase58(),
      treasury: treasuryPda.toBase58(),
    });
  } catch (error: any) {
    console.error("Relayer error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initialize merchant vault",
      },
      { status: 500 }
    );
  }
}