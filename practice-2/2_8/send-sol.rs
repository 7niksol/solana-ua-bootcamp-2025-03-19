use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    instruction::Instruction,
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    system_instruction,
    transaction::Transaction,
};
use std::env;
use dotenv::dotenv;
use std::str::FromStr;

fn main() {
    dotenv().ok();

    let secret_key = match env::var("SECRET_KEY") {
        Ok(value) => value,
        Err(_) => {
            println!("❌ Add SECRET_KEY to .env!");
            std::process::exit(1);
        }
    };

    let secret_key_bytes: Vec<u8> =
        serde_json::from_str(&secret_key).expect("Invalid secret key format");
    let sender = Keypair::from_bytes(&secret_key_bytes).expect("Invalid key bytes");

    let rpc_url = "https://api.devnet.solana.com";
    let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());

    println!("🔑 Our public key is: {}", sender.pubkey());

    let recipient = Pubkey::from_str("7Rxo6uNYikHHxSZp37knddHcrB2J3DrwCfBbP2tNBrvs").unwrap();
    println!("💸 Attempting to send 0.01 SOL to {}...", recipient);

    let lamports = (0.01 * solana_sdk::native_token::LAMPORTS_PER_SOL as f64) as u64;
    let transfer_instruction = system_instruction::transfer(
        &sender.pubkey(),
        &recipient,
        lamports,
    );

    let memo_text = "Hello from Solana!";
    println!("📝 memo is: {}", memo_text);

    let memo_program_id = Pubkey::from_str("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr").unwrap();
    let memo_instruction = Instruction {
        program_id: memo_program_id,
        accounts: vec![],
        data: memo_text.as_bytes().to_vec(),
    };

    let message = Message::new(&[transfer_instruction, memo_instruction], Some(&sender.pubkey()));
    let mut transaction = Transaction::new_unsigned(message);
    let blockhash = client.get_latest_blockhash().unwrap();
    transaction.sign(&[&sender], blockhash);

    let signature = client.send_and_confirm_transaction(&transaction).unwrap();
    println!("✅ Transaction confirmed, signature: {}!", signature);
}