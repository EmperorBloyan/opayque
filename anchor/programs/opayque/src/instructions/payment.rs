use anchor_lang::prelude::*;
use crate::{ErrorCode, MerchantVault, ProtocolConfig, TerminalNonce, TreasuryAccount};

#[derive(Accounts)]
pub struct RegisterTerminalNonce<'info> {
    #[account(mut)]
    pub merchant_authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + TerminalNonce::LEN,
        seeds = [b"terminal_nonce", terminal_id.as_bytes(), merchant_authority.key().as_ref()],
        bump
    )]
    pub terminal_nonce: Account<'info, TerminalNonce>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessPayment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [b"merchant_vault", merchant_vault.authority.as_ref()], bump = merchant_vault.bump)]
    pub merchant_vault: Account<'info, MerchantVault>,
    #[account(mut, seeds = [b"opayque_treasury", merchant_vault.authority.as_ref()], bump = opayque_treasury.bump)]
    pub opayque_treasury: Account<'info, TreasuryAccount>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut, seeds = [b"terminal_nonce", terminal_nonce.terminal_id.as_bytes(), merchant_vault.authority.as_ref()], bump = terminal_nonce.bump)]
    pub terminal_nonce: Account<'info, TerminalNonce>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawVaultFunds<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"merchant_vault", merchant_vault.authority.as_ref()], bump = merchant_vault.bump)]
    pub merchant_vault: Account<'info, MerchantVault>,
    #[account(seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub fn register_terminal_nonce(
    ctx: Context<RegisterTerminalNonce>,
    terminal_id: String,
    nonce: u64,
    expires_at: u64,
) -> Result<()> {
    require!(expires_at > Clock::get()?.unix_timestamp as u64, ErrorCode::NonceExpired);

    let nonce_account = &mut ctx.accounts.terminal_nonce;
    nonce_account.merchant = ctx.accounts.merchant_authority.key();
    nonce_account.terminal_id = terminal_id;
    nonce_account.nonce = nonce;
    nonce_account.expires_at = expires_at;
    nonce_account.used = false;
    nonce_account.bump = ctx.bumps.terminal_nonce;
    nonce_account.last_memo = String::new();
    Ok(())
}

pub fn process_payment(ctx: Context<ProcessPayment>, amount: u64, nonce: u64, memo: String) -> Result<()> {
    require!(!ctx.accounts.protocol_config.paused, ErrorCode::CircuitBreakerOpen);

    let nonce_account = &mut ctx.accounts.terminal_nonce;
    require!(!nonce_account.used, ErrorCode::NonceAlreadyUsed);
    require!(nonce_account.nonce == nonce, ErrorCode::InvalidNonce);
    require!(nonce_account.expires_at > Clock::get()?.unix_timestamp as u64, ErrorCode::NonceExpired);

    let fee = amount.checked_mul(25).ok_or(ErrorCode::MathOverflow)? / 10_000;
    let merchant_amount = amount.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;

    let vault = &mut ctx.accounts.merchant_vault;
    vault.collected_balance = vault.collected_balance.checked_add(merchant_amount).ok_or(ErrorCode::MathOverflow)?;

    let treasury = &mut ctx.accounts.opayque_treasury;
    treasury.collected_balance = treasury.collected_balance.checked_add(fee).ok_or(ErrorCode::MathOverflow)?;

    nonce_account.used = true;
    nonce_account.last_memo = memo;

    emit!(crate::PaymentSettled {
        merchant: vault.authority,
        amount,
        fee,
        merchant_amount,
        nonce,
    });

    Ok(())
}

pub fn withdraw_vault_funds(ctx: Context<WithdrawVaultFunds>, amount: u64, approved: bool) -> Result<()> {
    require!(approved, ErrorCode::WithdrawNotApproved);
    require!(ctx.accounts.authority.key() == ctx.accounts.merchant_vault.authority, ErrorCode::UnauthorizedAuthority);

    let vault = &mut ctx.accounts.merchant_vault;
    vault.collected_balance = vault.collected_balance.checked_sub(amount).ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}
