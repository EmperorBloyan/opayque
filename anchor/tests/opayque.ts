import * as anchor from "@coral-xyz/anchor";
import { Program, BN, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createAccount,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("opayque program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const workspace = anchor.workspace as Record<string, unknown>;
  const program = workspace.opayque as unknown as Program<Idl>;
  const admin = Keypair.generate();
  const merchant = Keypair.generate();
  const terminal = Keypair.generate();

  let protocolConfigPda: PublicKey;
  let merchantVaultPda: PublicKey;
  let treasuryPda: PublicKey;
  let noncePda: PublicKey;
  let receiptPda: PublicKey;
  let mint: PublicKey;
  let payerTokenAccount: PublicKey;
  let merchantTokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;
  let merchantDestinationTokenAccount: PublicKey;

  const fundKeypair = async (keypair: Keypair) => {
    const airdropSignature = await provider.connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature: airdropSignature, ...latestBlockhash }, "confirmed");
  };

  before(async () => {
    await fundKeypair(admin);
    await fundKeypair(merchant);
    await fundKeypair(terminal);

    mint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6,
    );
    payerTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        terminal.publicKey,
      )
    ).address;
    merchantTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        merchant.publicKey,
      )
    ).address;
    treasuryTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        admin.publicKey,
      )
    ).address;
    merchantDestinationTokenAccount = await createAccount(
      provider.connection,
      provider.wallet.payer,
      mint,
      merchant.publicKey,
      Keypair.generate(),
    );
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      mint,
      payerTokenAccount,
      provider.wallet.payer,
      10_000_000,
    );

    [protocolConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_config")], program.programId);
    [merchantVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("merchant_vault"), merchant.publicKey.toBuffer()], program.programId);
    [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("opayque_treasury"), merchant.publicKey.toBuffer()], program.programId);
    [noncePda] = PublicKey.findProgramAddressSync([Buffer.from("terminal_nonce"), Buffer.from("terminal-001"), merchant.publicKey.toBuffer()], program.programId);
    [receiptPda] = PublicKey.findProgramAddressSync([Buffer.from("payment_receipt"), merchant.publicKey.toBuffer(), new BN(7).toArrayLike(Buffer, "le", 8)], program.programId);
  });

  it("initializes a merchant vault", async () => {
    await program.methods
      .initializeProtocol(admin.publicKey)
      .accounts({
        payer: admin.publicKey,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    await program.methods
      .initializeMerchantVault(new BN(25), merchant.publicKey, 6)
      .accounts({
        merchantAuthority: merchant.publicKey,
        payer: merchant.publicKey,
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    const vaultAccount = await program.account.merchantVault.fetch(merchantVaultPda);
    expect(vaultAccount.authority.toBase58()).to.equal(merchant.publicKey.toBase58());
    expect(vaultAccount.feeBps.toNumber()).to.equal(25);
    expect(vaultAccount.tokenDecimals).to.equal(6);
  });

  it("settles a payment and deducts the protocol fee", async () => {
    const nonce = new BN(7);

    await program.methods
      .registerTerminalNonce("terminal-001", nonce, new BN(Math.floor(Date.now() / 1000) + 600))
      .accounts({
        merchantAuthority: merchant.publicKey,
        terminalNonce: noncePda,
        payer: merchant.publicKey,
        protocolConfig: protocolConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    await program.methods
      .processPayment(new BN(10_000_000), nonce, "checkout-001")
      .accounts({
        payer: terminal.publicKey,
        payerTokenAccount,
        mint,
        merchantTokenAccount,
        treasuryTokenAccount,
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        terminalNonce: noncePda,
        paymentReceipt: receiptPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([terminal])
      .rpc();

    const vaultAccount = await program.account.merchantVault.fetch(merchantVaultPda);
    const treasuryAccount = await program.account.treasuryAccount.fetch(treasuryPda);
    expect(vaultAccount.collectedBalance.toNumber()).to.equal(9_975_000);
    expect(treasuryAccount.collectedBalance.toNumber()).to.equal(25_000);
    const receipt = await program.account.paymentReceipt.fetch(receiptPda);
    expect(receipt.payer.toBase58()).to.equal(terminal.publicKey.toBase58());
    expect(receipt.amount.toNumber()).to.equal(10_000_000);
    expect(receipt.fee.toNumber()).to.equal(25_000);
    expect(receipt.merchantAmount.toNumber()).to.equal(9_975_000);
    expect(receipt.nonce.toNumber()).to.equal(7);

    await program.methods
      .withdrawVaultFunds(new BN(1_000_000))
      .accounts({
        authority: merchant.publicKey,
        merchantVault: merchantVaultPda,
        merchantTokenAccount,
        destinationTokenAccount: merchantDestinationTokenAccount,
        mint,
        protocolConfig: protocolConfigPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    expect(Number((await getAccount(provider.connection, merchantTokenAccount)).amount)).to.equal(8_975_000);
    expect(Number((await getAccount(provider.connection, merchantDestinationTokenAccount)).amount)).to.equal(1_000_000);
  });

  it("rejects replaying the same nonce", async () => {
    await expectRejected(
      program.methods
        .processPayment(new BN(5_000_000), new BN(7), "checkout-002")
        .accounts({
          payer: terminal.publicKey,
          payerTokenAccount,
          mint,
          merchantTokenAccount,
          treasuryTokenAccount,
          merchantVault: merchantVaultPda,
          opayqueTreasury: treasuryPda,
          protocolConfig: protocolConfigPda,
          terminalNonce: noncePda,
          paymentReceipt: receiptPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([terminal])
        .rpc(),
      /nonce|expired|used|already in use/i,
    );
  });

  it("rejects unauthorized withdrawals", async () => {
    const rogue = Keypair.generate();
    await fundKeypair(rogue);
    const rogueTokenAccount = (
      await getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        rogue.publicKey,
      )
    ).address;

    await expectRejected(
      program.methods
        .withdrawVaultFunds(new BN(1_000_000))
        .accounts({
          authority: rogue.publicKey,
          merchantVault: merchantVaultPda,
          merchantTokenAccount,
          destinationTokenAccount: rogueTokenAccount,
          mint,
          protocolConfig: protocolConfigPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([rogue])
        .rpc(),
      /authority|constraint/i,
    );
  });
});

async function expectRejected(action: Promise<unknown>, pattern: RegExp) {
  try {
    await action;
    expect.fail("Expected the transaction to be rejected");
  } catch (error) {
    if (error instanceof Error && pattern.test(error.message)) return;
    throw error;
  }
}
