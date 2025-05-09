use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};
use anchor_spl::token_interface::{TokenAccount as InterfaceTokenAccount, Mint, TokenInterface};
use crate::state::Offer;

#[derive(Accounts)]
pub struct CloseOffer<'info> {
    #[account(mut)]
    pub offer: Account<'info, Offer>,

    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mut, address = offer.token_mint_a)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, InterfaceTokenAccount>,

    #[account(mut)]
    pub maker_token_account: Account<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn close_offer(ctx: Context<CloseOffer>) -> Result<()> {
    let offer = &ctx.accounts.offer;
    let vault = &ctx.accounts.vault;
    let maker_token_account = &ctx.accounts.maker_token_account;
    let maker = &ctx.accounts.maker;
    let token_program = &ctx.accounts.token_program;

    // Вертаємо всі токени з vault назад мейкеру
    if vault.amount > 0 {
        let cpi_accounts = Transfer {
            from: vault.to_account_info(),
            to: maker_token_account.to_account_info(),
            authority: offer.to_account_info(),
        };
        let seeds = &[b"offer", offer.maker.as_ref(), &offer.id.to_le_bytes()];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
        token::transfer(cpi_ctx, vault.amount)?;
    }

    // Закриваємо vault акаунт, SOL за ренту повертається мейкеру
    let cpi_accounts = CloseAccount {
        account: vault.to_account_info(),
        destination: maker.to_account_info(),
        authority: offer.to_account_info(),
    };
    let seeds = &[b"offer", offer.maker.as_ref(), &offer.id.to_le_bytes()];
    let signer = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, signer);
    token::close_account(cpi_ctx)?;

    // Закриття самого оферу (через close = maker в derive)
    Ok(())
}