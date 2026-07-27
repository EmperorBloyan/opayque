use anchor_lang::prelude::*;

pub mod instructions;

pub use instructions::admin::{initialize_protocol, InitializeProtocol, toggle_circuit_breaker, ToggleCircuitBreaker};
pub use instructions::merchant::{initialize_merchant_vault, InitializeMerchantVault};
pub use instructions::payment::{process_payment, register_terminal_nonce, withdraw_vault_funds, ProcessPayment, RegisterTerminalNonce, WithdrawVaultFunds};

declare_id!("5K1AHcRKR7WDUf6agGthMm7rPKwN384pFzJMGG2oCmGp");

#[program]
pub mod opayque {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, admin: Pubkey) -> Result<()> {
        instructions::admin::initialize_protocol(ctx, admin)
    }

    pub fn initialize_merchant_vault(
        ctx: Context<InitializeMerchantVault>,
        fee_bps: u64,
        merchant: Pubkey,
        token_decimals: u8,
    ) -> Result<()> {
        instructions::merchant::initialize_merchant_vault(ctx, fee_bps, merchant, token_decimals)
    }

    pub fn register_terminal_nonce(
        ctx: Context<RegisterTerminalNonce>,
        terminal_id: String,
        nonce: u64,
        expires_at: u64,
    ) -> Result<()> {
        instructions::payment::register_terminal_nonce(ctx, terminal_id, nonce, expires_at)
    }

    pub fn process_payment(ctx: Context<ProcessPayment>, amount: u64, nonce: u64, memo: String) -> Result<()> {
        instructions::payment::process_payment(ctx, amount, nonce, memo)
    }

    pub fn withdraw_vault_funds(ctx: Context<WithdrawVaultFunds>, amount: u64, approved: bool) -> Result<()> {
        instructions::payment::withdraw_vault_funds(ctx, amount, approved)
    }

    pub fn toggle_circuit_breaker(ctx: Context<ToggleCircuitBreaker>, paused: bool) -> Result<()> {
        instructions::admin::toggle_circuit_breaker(ctx, paused)
    }
}

#[account]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize = 32 + 1 + 1;
}

#[account]
pub struct MerchantVault {
    pub authority: Pubkey,
    pub merchant: Pubkey,
    pub fee_bps: u64,
    pub token_decimals: u8,
    pub bump: u8,
    pub collected_balance: u64,
    pub created_at: u64,
}

impl MerchantVault {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 1 + 8 + 8;
}

#[account]
pub struct TreasuryAccount {
    pub authority: Pubkey,
    pub merchant: Pubkey,
    pub bump: u8,
    pub collected_balance: u64,
}

impl TreasuryAccount {
    pub const LEN: usize = 32 + 32 + 1 + 8;
}

#[account]
pub struct TerminalNonce {
    pub merchant: Pubkey,
    pub terminal_id: String,
    pub nonce: u64,
    pub expires_at: u64,
    pub used: bool,
    pub bump: u8,
    pub last_memo: String,
}

impl TerminalNonce {
    pub const LEN: usize = 32 + 4 + 8 + 8 + 1 + 1 + 4;
}

#[event]
pub struct PaymentSettled {
    pub merchant: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub merchant_amount: u64,
    pub nonce: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("invalid fee configuration")]
    InvalidFee,
    #[msg("math overflow")]
    MathOverflow,
    #[msg("nonce already used")]
    NonceAlreadyUsed,
    #[msg("invalid nonce")]
    InvalidNonce,
    #[msg("nonce expired")]
    NonceExpired,
    #[msg("circuit breaker open")]
    CircuitBreakerOpen,
    #[msg("withdrawal not approved")]
    WithdrawNotApproved,
    #[msg("unauthorized authority")]
    UnauthorizedAuthority,
}
