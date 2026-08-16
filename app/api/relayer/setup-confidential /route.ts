import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
// Import your IDL and program ID
// import idl from "@/anchor/target/idl/opayque.json";
// import { Opayque } from "@/types/opayque";

const RELAYER_SECRET = process.env.RELAYER_PRIVATE_KEY; // base58 or JSON array
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

export async function POST(req: Request) {
  try {
      const body = await req.json();
          const { merchantPublicKey, params } = body;

              if (!merchantPublicKey) {
                    return NextResponse.json({ success: false, error: "Missing merchantPublicKey" }, { status: 400 });
                        }

                            if (!RELAYER_SECRET) {
                                  return NextResponse.json({ success: false, error: "Relayer not configured" }, { status: 500 });
                                      }

                                          // Load relayer keypair
                                              let relayerKeypair: Keypair;
                                                  try {
                                                        const secret = RELAYER_SECRET.startsWith("[")
                                                                ? Uint8Array.from(JSON.parse(RELAYER_SECRET))
                                                                        : Uint8Array.from(Buffer.from(RELAYER_SECRET, "base64")); // adjust decoding as needed
                                                                              relayerKeypair = Keypair.fromSecretKey(secret);
                                                                                  } catch {
                                                                                        return NextResponse.json({ success: false, error: "Invalid relayer key" }, { status: 500 });
                                                                                            }

                                                                                                const connection = new Connection(RPC_URL, "confirmed");
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

                                                                                                                                                                                              const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
                                                                                                                                                                                                  // const program = new Program(idl as any, provider);

                                                                                                                                                                                                      // Example: Build the confidential setup instruction here
                                                                                                                                                                                                          // const tx = await program.methods
                                                                                                                                                                                                              //   .initializeConfidentialAccount(...)
                                                                                                                                                                                                                  //   .accounts({
                                                                                                                                                                                                                      //     merchant: new PublicKey(merchantPublicKey),
                                                                                                                                                                                                                          //     // ... other accounts
                                                                                                                                                                                                                              //   })
                                                                                                                                                                                                                                  //   .transaction();

                                                                                                                                                                                                                                      // For now return success structure (replace with real tx once program is ready)
                                                                                                                                                                                                                                          return NextResponse.json({
                                                                                                                                                                                                                                                success: true,
                                                                                                                                                                                                                                                      message: "Confidential account setup completed via relayer",
                                                                                                                                                                                                                                                            // signature: await connection.sendTransaction(tx, [relayerKeypair]),
                                                                                                                                                                                                                                                                });
                                                                                                                                                                                                                                                                  } catch (error: any) {
                                                                                                                                                                                                                                                                      console.error("Relayer setup-confidential error:", error);
                                                                                                                                                                                                                                                                          return NextResponse.json(
                                                                                                                                                                                                                                                                                { success: false, error: error.message || "Relayer failed" },
                                                                                                                                                                                                                                                                                      { status: 500 }
                                                                                                                                                                                                                                                                                          );
                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                            }