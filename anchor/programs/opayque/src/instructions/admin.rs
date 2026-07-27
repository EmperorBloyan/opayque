use anchor_lang::prelude::*;
use crate::{ProtocolConfig};

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(init, payer = payer, space = 8 + ProtocolConfig::LEN, seeds = [b"protocol_config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ToggleCircuitBreaker<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"protocol_config"], bump = protocol_config.bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_protocol(ctx: Context<InitializeProtocol>, admin: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.protocol_config;
    config.admin = admin;
    config.paused = false;
    config.bump = ctx.bumps.protocol_config;
    Ok(())
}

pub fn toggle_circuit_breaker(ctx: Context<ToggleCircuitBreaker>, paused: bool) -> Result<()> {
    require!(ctx.accounts.authority.key() == ctx.accounts.protocol_config.admin, crate::ErrorCode::UnauthorizedAuthority);
    ctx.accounts.protocol_config.paused = paused;
    Ok(())
}
