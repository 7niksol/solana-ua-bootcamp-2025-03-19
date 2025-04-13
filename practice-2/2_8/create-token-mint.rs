use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{Keypair, Signer},
    transaction::Transaction,
    system_instruction,
};
use spl_token::{instruction::initialize_mint, state::Mint, id as token_program_id};
use solana_program::program_pack::Pack;
use std::env;
use dotenv::dotenv;
use serde_json;

fn main() {
    dotenv().ok();

    let secret_key = env::var("SECRET_KEY").expect("Add SECRET_KEY to .env!");
    let secret_key_bytes: Vec<u8> = serde_json::from_str(&secret_key).expect("Invalid key format");
    let payer = Keypair::from_bytes(&secret_key_bytes).expect("Invalid key bytes");

    let rpc_url = "https://api.devnet.solana.com";
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    println!("🔑 Our public key is: {}", payer.pubkey());

    let mint = Keypair::new();

    let rent_lamports = client
        .get_minimum_balance_for_rent_exemption(Mint::LEN)
        .expect("Couldn't fetch rent");

    let create_account_ix = system_instruction::create_account(
        &payer.pubkey(),
        &mint.pubkey(),
        rent_lamports,
        Mint::LEN as u64,
        &token_program_id(),
    );

    let init_mint_ix = initialize_mint(
        &token_program_id(),
        &mint.pubkey(),
        &payer.pubkey(),
        None,
        2,
    )
    .expect("Failed to build initialize_mint instruction");

    let blockhash = client.get_latest_blockhash().unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[create_account_ix, init_mint_ix],
        Some(&payer.pubkey()),
        &[&payer, &mint],
        blockhash,
    );

    client
        .send_and_confirm_transaction(&tx)
        .expect("Failed to send transaction");

    println!(
        "✅ Token Mint: https://explorer.solana.com/address/{}?cluster=devnet",
        mint.pubkey()
    );
}