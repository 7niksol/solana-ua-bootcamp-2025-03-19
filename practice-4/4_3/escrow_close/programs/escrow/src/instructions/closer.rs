use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::state::Offer;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CloseOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        mut,
        close = maker,
        seeds = [b"offer", maker.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
        has_one = token_mint_a,
    )]
    pub offer: Account<'info, Offer>,

    #[account(mut, address = offer.token_mint_a)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program,
    )]
    pub maker_ata_a: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn close_offer(context: Context<CloseOffer>, _id: u64) -> Result<()> {
    let offer = &context.accounts.offer;

    let maker_key = context.accounts.maker.key();
    let id_bytes = context.accounts.offer.id.to_le_bytes();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"offer".as_ref(),
        maker_key.as_ref(),
        id_bytes.as_ref(),
        &[offer.bump],
    ]];

    let transfer_ctx = CpiContext::new_with_signer(
        context.accounts.token_program.to_account_info(),
        TransferChecked {
            from: context.accounts.vault.to_account_info(),
            mint: context.accounts.token_mint_a.to_account_info(),
            to: context.accounts.maker_ata_a.to_account_info(),
            authority: context.accounts.offer.to_account_info(),
        },
        signer_seeds,
    );

    transfer_checked(
        transfer_ctx,
        context.accounts.vault.amount,
        context.accounts.token_mint_a.decimals,
    )?;

    let close_vault_ctx = CpiContext::new_with_signer(
        context.accounts.token_program.to_account_info(),
        CloseAccount {
            account: context.accounts.vault.to_account_info(),
            destination: context.accounts.maker.to_account_info(),
            authority: context.accounts.offer.to_account_info(),
        },
        signer_seeds,
    );

    close_account(close_vault_ctx)
}