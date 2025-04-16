import "dotenv/config";
import { getExplorerLink } from "@solana-developers/helpers";
import { Keypair, clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { createMint, createMultisig } from "@solana/spl-token";

let privateKey = process.env["SECRET_KEY"];
if (!privateKey) {
  console.log("Add SECRET_KEY to .env!");
  process.exit(1);
}
const sender = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privateKey)));

let signer2Key = process.env["SECRET_KEY_2"];
if (!signer2Key) {
  console.log("Add SECRET_KEY_2 to .env!");
  process.exit(1);
}
const signer2 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(signer2Key)));

let signer3Key = process.env["SECRET_KEY_3"];
if (!signer3Key) {
  console.log("Add SECRET_KEY_3 to .env!");
  process.exit(1);
}
const signer3 = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(signer3Key)));

const connection = new Connection(clusterApiUrl("devnet"));

console.log(`🔑 Our public key is: ${sender.publicKey.toBase58()}`);

let multisig;
if (process.env["MULTISIG_ADDRESS"]) {
  multisig = new PublicKey(process.env["MULTISIG_ADDRESS"]);
  console.log(`Using multisig from env: ${multisig.toBase58()}`);
} else {
  multisig = await createMultisig(
    connection,
    sender,
    [sender.publicKey, signer2.publicKey, signer3.publicKey],
    3
  );
  console.log(`Created new multisig: ${multisig.toBase58()}`);
}

const tokenMint = await createMint(
  connection,
  sender,
  multisig,
  null,
  2
);

console.log("Multisig:", multisig.toBase58());
const link = getExplorerLink("address", tokenMint.toString(), "devnet");
console.log(`✅ Token Mint: ${link}`);