use anchor_lang::prelude::*;

declare_id!("5K1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmGp");

#[program]
pub mod opayque {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("✅ Opayque Program Initialized!");
        Ok(())
    }

    pub fn shielded_transfer(ctx: Context<ShieldedTransfer>, amount: u64, memo: String) -> Result<()> {
        msg!("🛡️ Shielded Transfer Logged on-chain!");
        msg!("Amount: {} micro USDC", amount);
        msg!("Memo: {}", memo);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShieldedTransfer<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,
}
