import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Opayque } from "../target/types/opayque";

describe("opayque anchor smoke test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.opayque as Program<Opayque>;

  it("loads the opayque program", async () => {
    const idl = await program.account.protocolConfig.all();
    expect(idl).toBeDefined();
  });
});
