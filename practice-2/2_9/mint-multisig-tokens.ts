import "dotenv/config";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { mintTo } from "@solana/spl-token";
import { getExplorerLink } from "@solana-developers/helpers";

let privateKey = process.env["SECRET_KEY"];
if (!privateKey) {
  console.log("Add SECRET_KEY to .env!");
  process.exit(1);
}
const sender = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));

let secretKey2 = process.env["SECRET_KEY_2"];
if (!secretKey2) {
  console.log("Add SECRET_KEY_2 to .env!");
  process.exit(1);
}
const signer2 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey2)));

let secretKey3 = process.env["SECRET_KEY_3"];
if (!secretKey3) {
  console.log("Add SECRET_KEY_3 to .env!");
  process.exit(1);
}
const signer3 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey3)));

const multisig = new PublicKey("9yEzSzWKRto7pA4zAvpCWNMhCKU4UtQ5x77wAKGVV83i");

const connection = new Connection(clusterApiUrl("devnet"));
const MINOR_UNITS_PER_MAJOR_UNITS = Math.pow(10, 2);

const tokenMintAccount = new PublicKey("44ZyyZihSqzsdC7V668iuSPBoAhqmM6eQdpfY7B9E6WN");
const recipientAssociatedTokenAccount = new PublicKey("8uadQPBdQWWruoF5MMaj5i1xiAyzyC21BjPkJnS9xss1");

const transactionSignature = await mintTo(
  connection,
  sender,
  tokenMintAccount,
  recipientAssociatedTokenAccount,
  multisig,
  10 * MINOR_UNITS_PER_MAJOR_UNITS,
  [sender, signer2, signer3]
);

const link = getExplorerLink("transaction", transactionSignature, "devnet");

console.log("✅ Success!");
console.log(`Mint Token Transaction: ${link}`);