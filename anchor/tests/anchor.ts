import * as anchor from "@coral-xyz/anchor";
import { Program, type Idl } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("opayque anchor smoke test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const workspace = anchor.workspace as Record<string, unknown>;
  const program = workspace.opayque as unknown as Program<Idl>;

  it("loads the opayque program", async () => {
    const idl = await (program as any).account.protocolConfig.all();
    expect(idl).toBeDefined();
  });
});
