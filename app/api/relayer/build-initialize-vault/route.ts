import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import idl from "@/lib/idl/opayque.json";
import { getSolanaRpcUrl } from "@/lib/solana/constants";
import { getClientAddress, strictLimit } from "@/lib/rate-limit";
import { getOwnedMerchantForWallet } from "@/lib/auth/merchantRequest";

const RPC_URL = getSolanaRpcUrl();
const RELAYER_SECRET = process.env.RELAYER_PRIVATE_KEY;
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_OPAYQUE_PROGRAM_ID || "9tMdYGfZqKTURYHsgL1KSBK9h9i8EH9zRREhP7FcEKQL"
);

export async function POST(req: Request) {
  try {
    const { merchantPublicKey, feeBps = 0, tokenDecimals = 6 } = await req.json();

    const rateLimit = await strictLimit(`relayer:init:${getClientAddress(req)}`, true);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: rateLimit.error || "Too many initialization requests" }, { status: rateLimit.error ? 503 : 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
    }

    if (!merchantPublicKey || !RELAYER_SECRET) {
      return NextResponse.json({ success: false, error: "Missing data: Ensure Relayer Key is set." }, { status: 400 });
    }

    const ownership = await getOwnedMerchantForWallet(req, merchantPublicKey);
    if ("error" in ownership) return NextResponse.json({ success: false, error: ownership.error }, { status: ownership.status });
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 1000 || !Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 18) {
      return NextResponse.json({ success: false, error: "Invalid vault fee or token decimals" }, { status: 400 });
    }

    const secretKey = Uint8Array.from(JSON.parse(RELAYER_SECRET));
    const relayerKeypair = Keypair.fromSecretKey(secretKey);
    const merchant = new PublicKey(merchantPublicKey);

    const connection = new Connection(RPC_URL, "processed");

    const wallet = {
      publicKey: relayerKeypair.publicKey,
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    } as Wallet;

    // FIX: Change to "confirmed"
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program(idl as any, provider);
    const programId = (idl as any)?.address ? new PublicKey((idl as any).address) : PROGRAM_ID;
    const effectiveProgramId = program.programId ?? programId;

    if (!effectiveProgramId) {
      return NextResponse.json({ success: false, error: "Invalid IDL" }, { status: 500 });
    }

    const [merchantVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant_vault"), merchant.toBuffer()],
      effectiveProgramId
    );

    const vaultInfo = await connection.getAccountInfo(merchantVaultPda);
    if (vaultInfo) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        merchantVault: merchantVaultPda.toBase58(),
      });
    }

    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("opayque_treasury"), merchant.toBuffer()],
      effectiveProgramId
    );

    const [protocolConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_config")],
      effectiveProgramId
    );

    const tx = await (program.methods as any)
      .initializeMerchantVault(new BN(feeBps), merchant, tokenDecimals)
      .accounts({
        merchantAuthority: merchant,
        payer: relayerKeypair.publicKey,
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("processed");
    
    tx.feePayer = relayerKeypair.publicKey;
    tx.recentBlockhash = blockhash;
    tx.partialSign(relayerKeypair);

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return NextResponse.json({
      success: true,
      transaction: serialized.toString("base64"),
      blockhash,
      lastValidBlockHeight,
      rpcUrl: RPC_URL,
      network: RPC_URL.includes("mainnet") ? "mainnet-beta" : RPC_URL.includes("testnet") ? "testnet" : "devnet",
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
