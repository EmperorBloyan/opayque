use anchor_lang::prelude::*;

declare_id!("5k1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmgp");

#[program]
pub mod anchor {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
