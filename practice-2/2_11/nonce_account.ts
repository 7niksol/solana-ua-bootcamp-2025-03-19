import { 
    clusterApiUrl, 
    Connection, 
    Keypair, 
    LAMPORTS_PER_SOL, 
    NONCE_ACCOUNT_LENGTH, 
    NonceAccount,  
    sendAndConfirmRawTransaction, 
    SystemProgram, 
    Transaction,
} from '@solana/web3.js';
import 'dotenv/config';

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

////////////////////////////////////////////////////////////////////////////////////////////////////
// Create a nonce account with a nonce authority
// and fund it with 0.0015 SOL

let privateKey = process.env["SECRET_KEY"];
const nonceAuth = Uint8Array.from(JSON.parse(privateKey));
const nonceAuthKP = Keypair.fromSecretKey(nonceAuth);

const nonceKeypair = Keypair.generate();
const tx = new Transaction();

tx.feePayer = nonceAuthKP.publicKey;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

tx.add(
    SystemProgram.createAccount({
      fromPubkey: nonceAuthKP.publicKey,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: 0.0015 * LAMPORTS_PER_SOL,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    SystemProgram.nonceInitialize({
      noncePubkey: nonceKeypair.publicKey,
      authorizedPubkey: nonceAuthKP.publicKey,
    }),
  );
  
tx.sign(nonceKeypair, nonceAuthKP);

const sig = await sendAndConfirmRawTransaction(
    connection,
    tx.serialize({ requireAllSignatures: false }),
  );
  
console.log("Nonce initiated: ", sig);

////////////////////////////////////////////////////////////////////////////////////////////////
// Check the nonce account
// and get the nonce account data

const accountInfo = await connection.getAccountInfo(nonceKeypair.publicKey);
const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
console.log("Nonce Account State: ", nonceAccount);

////////////////////////////////////////////////////////////////////////////////////////////////
// Create a transaction to transfer SOL
// from the nonce account to a reciepient
// and sign it with the nonce authority

let privateKey1 = process.env["SECRET_KEY_2"];
const reciepient = Uint8Array.from(JSON.parse(privateKey1));
const reciepientKP = Keypair.fromSecretKey(reciepient);

const ix = SystemProgram.transfer({
    fromPubkey: nonceAuthKP.publicKey,
    toPubkey: reciepientKP.publicKey,
    lamports: 100,
  });

const advanceIX = SystemProgram.nonceAdvance({
    authorizedPubkey: nonceAuthKP.publicKey,
    noncePubkey: nonceKeypair.publicKey,
  });

const tx1 = new Transaction();
tx1.add(advanceIX);
tx1.add(ix);

tx1.recentBlockhash = nonceAccount.nonce;
tx1.feePayer = reciepientKP.publicKey;

tx1.partialSign(nonceAuthKP);

const startTime = Date.now();

////////////////////////////////////////////////////////////////////////////////////////////////
// Add a delay to test the absence of a time limit on nonce transactions

await new Promise(resolve => setTimeout(resolve, 150000)); // 150-second pause

////////////////////////////////////////////////////////////////////////////////////////////////
// Sign the transaction with the recipient
// and send it to the network

tx1.partialSign(reciepientKP);
const endTime = Date.now();

const sign = await sendAndConfirmRawTransaction(
  connection,
  tx1.serialize({ requireAllSignatures: false }),
);

console.log("Transaction signature:", sign);
console.log("Time spent signing and sending the transaction:", (endTime - startTime) / 1000, "seconds");
