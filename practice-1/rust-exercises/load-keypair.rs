use solana_sdk::signature::{Keypair, Signer};
use std::env;
use serde_json;
use dotenv::dotenv;

fn main() {
    dotenv().ok();

    let secret_key = match env::var("SECRET_KEY") {
        Ok(value) => value,
        Err(_) => {
            println!("Add SECRET_KEY to .env!");
            std::process::exit(1);
        }
    };

    let secret_key_bytes: Vec<u8> = serde_json::from_str(&secret_key).expect("Invalid secret key format");

    let keypair = Keypair::from_bytes(&secret_key_bytes).expect("Failed to create keypair");

    println!("Public key: {}", keypair.pubkey());
}