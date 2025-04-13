use dotenv::dotenv;
use serde_json;
use std::env;
use std::str::FromStr;

use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use spl_token::instruction::mint_to;
use spl_token::ID as TOKEN_PROGRAM_ID;

fn main() {
    dotenv().ok();

    let secret_key = env::var("SECRET_KEY").expect("Add SECRET_KEY to .env!");
    let secret_key_bytes: Vec<u8> =
        serde_json::from_str(&secret_key).expect("Invalid secret key format");
    let sender = Keypair::from_bytes(&secret_key_bytes).expect("Invalid key bytes");

    let rpc_url = "https://api.devnet.solana.com";
    let client =
        RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    println!("🔑 Sender pubkey: {}", sender.pubkey());

    let token_mint = Pubkey::from_str("CEM6midPCs3f7LG9heLEV7bcu7qEGjpcvNZaQrxVbzmK").unwrap();
    let recipient_ata =
        Pubkey::from_str("FKEJvCDA5VLd1rH1p4GNt235sQdizHKzupVy3aBVTdCg").unwrap();

    let amount = 10 * 10u64.pow(2); // 10.00 токенов

    let mint_ix = mint_to(
        &TOKEN_PROGRAM_ID,
        &token_mint,
        &recipient_ata,
        &sender.pubkey(),
        &[], // доп. подписанты
        amount,
    )
    .expect("Failed to create mint_to instruction");

    let blockhash = client.get_latest_blockhash().unwrap();

    let tx = Transaction::new_signed_with_payer(
        &[mint_ix],
        Some(&sender.pubkey()),
        &[&sender],
        blockhash,
    );

    let signature = client
        .send_and_confirm_transaction(&tx)
        .expect("Failed to send transaction");

    let link = format!(
        "https://explorer.solana.com/tx/{}?cluster=devnet",
        signature
    );

    println!("✅ Success!");
    println!("Mint Token Transaction: {}", link);
}