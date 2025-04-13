use mpl_token_metadata::{
    accounts::Metadata,
    instructions::CreateMetadataAccountV3Builder,
    types::{DataV2},
};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use std::str::FromStr;
use dotenv::dotenv;
use serde_json;
use std::env;

fn main() {
    dotenv().ok();
    let client = RpcClient::new("https://api.devnet.solana.com");
    let private_key: Vec<u8> = serde_json::from_str(&env::var("SECRET_KEY").expect("Add SECRET_KEY to .env!"))
        .expect("Parsing error JSON");
    let sender = Keypair::from_bytes(&private_key).expect("Invalid keypair bytes");
    let mint =
        Pubkey::from_str("78vdhh9Ja5oyVVdhVKcFcnCA7Zb1ytSVu3NcqyByYu54").expect("Invalid pubkey");
    let metadata_data = DataV2 {
        name: "Solana UA Bootcamp 2025-03-19".to_string(),
        symbol: "UAB-3".to_string(),
        uri: "https://arweave.net/1234".to_string(),
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };
    let (metadata_pda, _bump) = Metadata::find_pda(&mint);
    let metadata = CreateMetadataAccountV3Builder::new()
        .metadata(metadata_pda)
        .mint(mint)
        .mint_authority(sender.pubkey())
        .update_authority(sender.pubkey(), true)
        .payer(sender.pubkey())
        .data(metadata_data)
        .is_mutable(true)
        .instruction();
    let transaction = Transaction::new_signed_with_payer(
        &[metadata],
        Some(&sender.pubkey()),
        &[&sender],
        client
            .get_latest_blockhash()
            .expect("Failed to get latest blockhash"),
    );

    client
        .send_and_confirm_transaction(&transaction)
        .expect("Failed to send or confirm transaction");
    println!("✅ Look at the token mint again: {}", mint.to_string());
}