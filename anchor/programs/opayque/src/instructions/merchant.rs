use anchor_lang::prelude::*;
use crate::{ErrorCode, MerchantVault, ProtocolConfig, TreasuryAccount};

#[derive(Accounts)]
pub struct InitializeMerchantVault<'info> {
    #[account(mut)]
    pub merchant_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + MerchantVault::LEN,
        seeds = [b"merchant_vault", merchant_authority.key().as_ref()],
        bump
    )]
    pub merchant_vault: Account<'info, MerchantVault>,
    #[account(
        init,
        payer = payer,
        space = 8 + TreasuryAccount::LEN,
        seeds = [b"opayque_treasury", merchant_authority.key().as_ref()],
        bump
    )]
    pub opayque_treasury: Account<'info, TreasuryAccount>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_merchant_vault(
    ctx: Context<InitializeMerchantVault>,
    fee_bps: u64,
    merchant: Pubkey,
    token_decimals: u8,
) -> Result<()> {
    require!(fee_bps <= 10_000, ErrorCode::InvalidFee);

    let vault = &mut ctx.accounts.merchant_vault;
    vault.authority = ctx.accounts.merchant_authority.key();
    vault.merchant = merchant;
    vault.fee_bps = fee_bps;
    vault.token_decimals = token_decimals;
    vault.bump = ctx.bumps.merchant_vault;
    vault.collected_balance = 0;
    vault.created_at = Clock::get()?.unix_timestamp as u64;

    let treasury = &mut ctx.accounts.opayque_treasury;
    treasury.authority = ctx.accounts.protocol_config.admin;
    treasury.merchant = merchant;
    treasury.bump = ctx.bumps.opayque_treasury;
    treasury.collected_balance = 0;

    Ok(())
}
