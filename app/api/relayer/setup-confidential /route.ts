import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import idl from "@/lib/idl/opayque.json";

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

    // Wallet adapter interface for the relayer
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

    // Guard: Check if vault already exists
    const vaultInfo = await connection.getAccountInfo(merchantVaultPda);
    if (vaultInfo) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: "Merchant vault already initialized",
        merchantVault: merchantVaultPda.toBase58(),
      });
    }

    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("opayque_treasury"), merchant.toBuffer()],
      program.programId
    );

    const [protocolConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      program.programId
    );

    // Build instruction
    const tx = await program.methods
      .initializeMerchantVault(
        new BN(feeBps),
        merchant,
        tokenDecimals
      )
      .accounts({
        merchantAuthority: merchant,      // merchant wallet address
        payer: relayerKeypair.publicKey,  // relayer pays transaction & rent fees
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // Attach fresh blockhash and fee payer
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    
    tx.feePayer = relayerKeypair.publicKey;
    tx.recentBlockhash = blockhash;

    // Send transaction signed by relayer
    const signature = await connection.sendTransaction(tx, [relayerKeypair], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );

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
