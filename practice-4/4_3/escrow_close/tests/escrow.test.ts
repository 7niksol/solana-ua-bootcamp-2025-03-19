import { expect, describe, beforeAll, test } from "@jest/globals";
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ACCOUNT_SIZE,
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { randomBytes } from "crypto";
import { confirmTransaction, makeKeypairs } from "@solana-developers/helpers";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID;

export const getRandomBigNumber = (size: number = 8): BN =>
  new BN(randomBytes(size));

function areBnEqual(a: unknown, b: unknown): boolean | undefined {
  const isABn = a instanceof BN;
  const isBBn = b instanceof BN;
  if (isABn && isBBn) return a.eq(b);
  if (isABn === isBBn) return undefined;
  return false;
}
expect.addEqualityTesters([areBnEqual]);

const createTokenAndMintTo = async (
  connection: Connection,
  payer: PublicKey,
  tokenMint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  mintTo: Array<{ recepient: PublicKey; amount: number }>
): Promise<TransactionInstruction[]> => {
  const rentExempt = await getMinimumBalanceForRentExemptMint(connection);
  const initMintIxs: TransactionInstruction[] = [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: tokenMint,
      lamports: rentExempt,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM,
    }),
    createInitializeMint2Instruction(
      tokenMint,
      decimals,
      mintAuthority,
      null,
      TOKEN_PROGRAM
    ),
  ];

  const mintIxs = mintTo.flatMap(({ recepient, amount }) => {
    const ata = getAssociatedTokenAddressSync(
      tokenMint,
      recepient,
      false,
      TOKEN_PROGRAM
    );
    return [
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        ata,
        recepient,
        tokenMint,
        TOKEN_PROGRAM
      ),
      createMintToInstruction(
        tokenMint,
        ata,
        mintAuthority,
        amount,
        [],
        TOKEN_PROGRAM
      ),
    ];
  });

  return [...initMintIxs, ...mintIxs];
};

const getTokenBalanceOn =
  (connection: Connection) =>
  async (account: PublicKey): Promise<BN> => {
    const { value } = await connection.getTokenAccountBalance(account);
    return new BN(value.amount);
  };

describe("escrow", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;
  const program = anchor.workspace.Escrow as Program<Escrow>;

  const [alice, bob, usdcMint, wifMint] = makeKeypairs(4);

  const [
    aliceUsdcAccount,
    aliceWifAccount,
    bobUsdcAccount,
    bobWifAccount,
  ] = [alice, bob].flatMap((owner) =>
    [usdcMint, wifMint].map((mint) =>
      getAssociatedTokenAddressSync(
        mint.publicKey,
        owner.publicKey,
        false,
        TOKEN_PROGRAM
      )
    )
  );

  const offerId = getRandomBigNumber();

  beforeAll(async () => {
    // Fund Alice & Bob with SOL
    const solIxs = [alice, bob].map((o) =>
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: o.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      })
    );
    // Create & mint USDC: Alice 100M, Bob 20M
    const usdcIxs = await createTokenAndMintTo(
      connection,
      provider.publicKey,
      usdcMint.publicKey,
      6,
      alice.publicKey,
      [
        { recepient: alice.publicKey, amount: 100_000_000 },
        { recepient: bob.publicKey, amount: 20_000_000 },
      ]
    );
    // Create & mint WIF: Alice 5M, Bob 300M
    const wifIxs = await createTokenAndMintTo(
      connection,
      provider.publicKey,
      wifMint.publicKey,
      6,
      bob.publicKey,
      [
        { recepient: alice.publicKey, amount: 5_000_000 },
        { recepient: bob.publicKey, amount: 300_000_000 },
      ]
    );

    const tx = new Transaction();
    tx.instructions = [...solIxs, ...usdcIxs, ...wifIxs];
    await provider.sendAndConfirm(tx, [alice, bob, usdcMint, wifMint]);
  });

  const makeOfferTx = async (
    maker: Keypair,
    offerId: BN,
    offeredMint: PublicKey,
    offeredAmount: BN,
    wantedMint: PublicKey,
    wantedAmount: BN
  ): Promise<{ offerAddress: PublicKey; vaultAddress: PublicKey }> => {
    const sig = await program.methods
      .makeOffer(offerId, offeredAmount, wantedAmount)
      .accounts({
        maker: maker.publicKey,
        tokenMintA: offeredMint,
        tokenMintB: wantedMint,
        tokenProgram: TOKEN_PROGRAM,
      })
      .signers([maker])
      .rpc();
    await confirmTransaction(connection, sig);

    const [offerAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        maker.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const vaultAddress = getAssociatedTokenAddressSync(
      offeredMint,
      offerAddress,
      true,
      TOKEN_PROGRAM
    );
    return { offerAddress, vaultAddress };
  };

  const takeOfferTx = async (
    offerAddress: PublicKey,
    taker: Keypair
  ): Promise<void> => {
    const sig = await program.methods
      .takeOffer()
      .accounts({
        taker: taker.publicKey,
        offer: offerAddress,
        tokenProgram: TOKEN_PROGRAM,
      })
      .signers([taker])
      .rpc();
    await confirmTransaction(connection, sig);
  };

  const closeOfferTx = async (maker: Keypair, offerId: BN): Promise<void> => {
    const transactionSignature = await program.methods
      .closeOffer(offerId)
      .accounts({
        maker: maker.publicKey,
        tokenProgram: TOKEN_PROGRAM,
      })
      .signers([maker])
      .rpc();

    await confirmTransaction(connection, transactionSignature);
  };

  test("Offer created by Alice, vault holds the offer tokens", async () => {
    const offeredUsdc = new BN(10_000_000);
    const wantedWif = new BN(100_000_000);
    const getTokenBalance = getTokenBalanceOn(connection);

    const { offerAddress, vaultAddress } = await makeOfferTx(
      alice,
      offerId,
      usdcMint.publicKey,
      offeredUsdc,
      wifMint.publicKey,
      wantedWif
    );

    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(
      new BN(90_000_000)
    );
    expect(await getTokenBalance(vaultAddress)).toEqual(offeredUsdc);

    const offerAccount = await program.account.offer.fetch(offerAddress);
    expect(offerAccount.maker).toEqual(alice.publicKey);
    expect(offerAccount.tokenMintA).toEqual(usdcMint.publicKey);
    expect(offerAccount.tokenMintB).toEqual(wifMint.publicKey);
    expect(offerAccount.tokenBWantedAmount).toEqual(wantedWif);
  });

  
  test("Offer closed", async () => {
    const getTokenBalance = getTokenBalanceOn(connection);
    const [offerAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        alice.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    const vaultAddress = getAssociatedTokenAddressSync(
      usdcMint.publicKey,
      offerAddress,
      true,
      TOKEN_PROGRAM
    );
    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(
      new BN(90_000_000)
    );
    expect(await getTokenBalance(vaultAddress)).toEqual(
      new BN(10_000_000)
    );
    const beforeSol = await connection.getBalance(alice.publicKey);
    await closeOfferTx(alice,offerId);
    const afterSol = await connection.getBalance(alice.publicKey);
    const rentAta = await connection.getMinimumBalanceForRentExemption(AccountLayout.span);
    expect(afterSol - beforeSol).toBeGreaterThanOrEqual(rentAta - LAMPORTS_PER_SOL * 0.00001);
    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(
      new BN(100_000_000)
    );
    const vaultInfo = await connection.getAccountInfo(vaultAddress);
    expect(vaultInfo).toBeNull();
    const offerInfo = await connection.getAccountInfo(offerAddress);
    expect(offerInfo).toBeNull();
  });
});
