use solana_sdk::signature::{Keypair, Signer};

fn main() {
    let keypair = Keypair::new();
    println!("The public key is: {}", keypair.pubkey());
    println!("The secret key is: {:?}", keypair.to_bytes());
    println!("✅ Finished!");
}