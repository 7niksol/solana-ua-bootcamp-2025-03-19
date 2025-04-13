use std::env;
use std::str::FromStr;

use dotenv::dotenv;
use serde_json;

use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
};

use spl_token::ID as TOKEN_PROGRAM_ID;
use spl_associated_token_account::{get_associated_token_address, instruction::create_associated_token_account};

fn main() {
    dotenv().ok();

    let secret_key = env::var("SECRET_KEY").expect("Add SECRET_KEY to .env!");
    let secret_key_bytes: Vec<u8> =
        serde_json::from_str(&secret_key).expect("Invalid key format");
    let sender = Keypair::from_bytes(&secret_key_bytes).expect("Invalid keypair");

    let rpc_url = "https://api.devnet.solana.com";
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    println!("🔑 Our public key is: {}", sender.pubkey());

    let token_mint = Pubkey::from_str("CEM6midPCs3f7LG9heLEV7bcu7qEGjpcvNZaQrxVbzmK").unwrap();
    let recipient = Pubkey::from_str("9qMGXt3xnX2ebJjUAP8wr5vQGtABfg5TfZDWo8KCjjs4").unwrap();

    let ata = get_associated_token_address(&recipient, &token_mint);
    println!("📦 Associated Token Address: {}", ata);

    let account = client.get_account(&ata);

    if account.is_err() {
        println!("🆕 Token account doesn't exist. Creating...");

        let blockhash = client.get_latest_blockhash().unwrap();

        let ix = create_associated_token_account(
            &sender.pubkey(),  // payer
            &recipient,        // owner
            &token_mint,       // mint
            &TOKEN_PROGRAM_ID,    
        );

        let tx = solana_sdk::transaction::Transaction::new_signed_with_payer(
            &[ix],
            Some(&sender.pubkey()),
            &[&sender],
            blockhash,
        );

        client
            .send_and_confirm_transaction(&tx)
            .expect("Failed to create associated token account");

        println!("✅ Created token account: https://explorer.solana.com/address/{}?cluster=devnet", ata);
    } else {
        println!("✅ Token account already exists: https://explorer.solana.com/address/{}?cluster=devnet", ata);
    }
}