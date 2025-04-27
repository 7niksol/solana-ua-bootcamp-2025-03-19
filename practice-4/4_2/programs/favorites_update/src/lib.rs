use anchor_lang::prelude::*;

declare_id!("DABBEEKjXnmL6Bfedxrf8YkEAPZYLNCKe4utAGTTWPxH");

pub const ANCHOR_DISCRIMINATOR_SIZE: usize = 8;

#[account]
#[derive(InitSpace)]
pub struct FavoritesLegacy {
    pub number: u64,
    #[max_len(50)]
    pub color: String,
}

#[account]
#[derive(InitSpace)]
pub struct Favorites {
    pub number: u64,
    #[max_len(50)]
    pub color: String,
    pub authority: Pubkey,
    pub delegate: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct SetFavoritesLegacy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR_SIZE + FavoritesLegacy::INIT_SPACE,
        seeds = [b"favorites-legacy", user.key().as_ref()],
        bump,
    )]
    pub favorites: Account<'info, FavoritesLegacy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetFavorites<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR_SIZE + Favorites::INIT_SPACE,
        seeds = [b"favorites", user.key().as_ref()],
        bump,
    )]
    pub favorites: Account<'info, Favorites>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateFavorites<'info> {
    #[account(mut)]
    pub favorites: Account<'info, Favorites>,
    /// CHECK: Only used for pubkey comparison
    pub user: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"favorites", authority.key().as_ref()],
        bump,
    )]
    pub favorites: Account<'info, Favorites>,
}

#[program]
pub mod favorites_update {
    use super::*;

    pub fn set_favorites_legacy(ctx: Context<SetFavoritesLegacy>, number: u64, color: String) -> Result<()> {
        ctx.accounts.favorites.number = number;
        ctx.accounts.favorites.color = color;
        Ok(())
    }

    pub fn set_favorites(ctx: Context<SetFavorites>, number: u64, color: String) -> Result<()> {
        let favorites = &mut ctx.accounts.favorites;
        favorites.number = number;
        favorites.color = color;
        favorites.authority = ctx.accounts.user.key();
        favorites.delegate = None;
        Ok(())
    }

    pub fn set_authority(ctx: Context<SetAuthority>, new_delegate: Option<Pubkey>) -> Result<()> {
        ctx.accounts.favorites.delegate = new_delegate;
        Ok(())
    }

    pub fn update_favorites(ctx: Context<UpdateFavorites>, number: u64, color: String) -> Result<()> {
        let user = ctx.accounts.user.key();
        let favorites = &mut ctx.accounts.favorites;
        if favorites.authority != user {
            match favorites.delegate {
                Some(delegate) if delegate == user => {},
                _ => return Err(error!(ErrorCode::Unauthorized)),
            }
        }
        favorites.number = number;
        favorites.color = color;
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to update this account")]
    Unauthorized,
}