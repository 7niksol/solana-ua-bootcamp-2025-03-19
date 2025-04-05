use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transport::TransportError;
use std::str::FromStr;

fn main() -> Result<(), TransportError> {
    let client = RpcClient::new("https://api.devnet.solana.com".to_string());
    println!("⚡️ Connected to devnet");

    let public_key = Pubkey::from_str("9qMGXt3xnX2ebJjUAP8wr5vQGtABfg5TfZDWo8KCjjs4").unwrap();
    
    let balance_lamports = client.get_balance(&public_key)?;
    
    let balance_sol = balance_lamports as f64 / solana_sdk::native_token::LAMPORTS_PER_SOL as f64;

    println!("💰 The balance for the wallet at address {} is: {}", public_key, balance_sol);
    Ok(())
}