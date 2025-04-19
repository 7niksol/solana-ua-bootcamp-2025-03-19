import { clusterApiUrl, Connection, Keypair, PublicKey } from '@solana/web3.js';
import { transfer } from '@solana/spl-token';
import "dotenv/config";

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const amount = 5 * Math.pow(10, 2);

let privateKey = process.env["SECRET_KEY"];
const asArray = Uint8Array.from(JSON.parse(privateKey));
let privateKey1 = process.env["SECRET_KEY_2"];
const asArray1 = Uint8Array.from(JSON.parse(privateKey1));

const fromTokenAcc = new PublicKey("2Z92R7BznGhTaCeyrGYsdzjujVW6LxsWSL58T4eABtQe");
const toTokenAcc = new PublicKey("FKEJvCDA5VLd1rH1p4GNt235sQdizHKzupVy3aBVTdCg");
const owner_fromTokenAcc = Keypair.fromSecretKey(asArray);
const owner_toTokenAcc = Keypair.fromSecretKey(asArray1);

const transaction = await transfer(
    connection,
    owner_toTokenAcc,
    fromTokenAcc,
    toTokenAcc,
    owner_fromTokenAcc,
    amount,
);

console.log(`✅ Transaction confirmed, signature: ${transaction}!`);