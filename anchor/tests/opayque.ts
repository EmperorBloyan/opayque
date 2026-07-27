import * as anchor from "@coral-xyz/anchor";
import { Program, BN, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

  const fundKeypair = async (keypair: Keypair) => {
    const airdropSignature = await provider.connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({ signature: airdropSignature, ...latestBlockhash }, "confirmed");
  };

  before(async () => {
    await fundKeypair(admin);
    await fundKeypair(merchant);
    await fundKeypair(terminal);

    [protocolConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_config")], program.programId);
    [merchantVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("merchant_vault"), merchant.publicKey.toBuffer()], program.programId);
    [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("opayque_treasury"), merchant.publicKey.toBuffer()], program.programId);
    [noncePda] = PublicKey.findProgramAddressSync([Buffer.from("terminal_nonce"), Buffer.from("terminal-001"), merchant.publicKey.toBuffer()], program.programId);
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
        merchantVault: merchantVaultPda,
        opayqueTreasury: treasuryPda,
        protocolConfig: protocolConfigPda,
        terminalNonce: noncePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([terminal])
      .rpc();

    const vaultAccount = await program.account.merchantVault.fetch(merchantVaultPda);
    const treasuryAccount = await program.account.treasuryAccount.fetch(treasuryPda);
    expect(vaultAccount.collectedBalance.toNumber()).to.equal(9_975_000);
    expect(treasuryAccount.collectedBalance.toNumber()).to.equal(25_000);
  });

  it("rejects replaying the same nonce", async () => {
    await expect(
      program.methods
        .processPayment(new BN(5_000_000), new BN(7), "checkout-002")
        .accounts({
          payer: terminal.publicKey,
          merchantVault: merchantVaultPda,
          opayqueTreasury: treasuryPda,
          protocolConfig: protocolConfigPda,
          terminalNonce: noncePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([terminal])
        .rpc()
    ).to.be.rejectedWith(/nonce|expired|used/i);
  });

  it("rejects unauthorized withdrawals", async () => {
    const rogue = Keypair.generate();
    await fundKeypair(rogue);

    await expect(
      program.methods
        .withdrawVaultFunds(new BN(1_000_000), false)
        .accounts({
          authority: rogue.publicKey,
          merchantVault: merchantVaultPda,
          protocolConfig: protocolConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([rogue])
        .rpc()
    ).to.be.rejectedWith(/authority|approval/i);
  });
});
