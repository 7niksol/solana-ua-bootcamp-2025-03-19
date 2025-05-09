import { expect, describe, beforeAll, test } from "@jest/globals";
import * as anchor from "@coral-xyz/anchor";
import { type Program, BN } from "@coral-xyz/anchor";
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
  AccountLayout,
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { randomBytes } from "crypto";

import { confirmTransaction, makeKeypairs } from "@solana-developers/helpers";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID;

export const getRandomBigNumber = (size: number = 8) => {
  return new BN(randomBytes(size));
};

function areBnEqual(a: unknown, b: unknown): boolean | undefined {
  const isABn = a instanceof BN;
  const isBBn = b instanceof BN;

  if (isABn && isBBn) {
    return a.eq(b);
  } else if (isABn === isBBn) {
    return undefined;
  } else {
    return false;
  }
}
expect.addEqualityTesters([areBnEqual]);

const createTokenAndMintTo = async (
  connection: Connection,
  payer: PublicKey,
  tokenMint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
  mintTo: Array<{ recepient: PublicKey; amount: number }>
): Promise<Array<TransactionInstruction>> => {
  let minimumLamports = await getMinimumBalanceForRentExemptMint(connection);

  let createTokeIxs = [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: tokenMint,
      lamports: minimumLamports,
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

  let mintToIxs = mintTo.flatMap(({ recepient, amount }) => {
    const ataAddress = getAssociatedTokenAddressSync(
      tokenMint,
      recepient,
      false,
      TOKEN_PROGRAM
    );

    return [
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        ataAddress,
        recepient,
        tokenMint,
        TOKEN_PROGRAM
      ),
      createMintToInstruction(
        tokenMint,
        ataAddress,
        mintAuthority,
        amount,
        [],
        TOKEN_PROGRAM
      ),
    ];
  });

  return [...createTokeIxs, ...mintToIxs];
};

const getTokenBalanceOn = (
  connection: Connection,
) => async (
  tokenAccountAddress: PublicKey,
): Promise<BN> => {
  const tokenBalance = await connection.getTokenAccountBalance(tokenAccountAddress);
  return new BN(tokenBalance.value.amount);
};

// Jest debug console it too verbose.
// const jestConsole = console;

describe("escrow", () => {
  // Use the cluster and the keypair from Anchor.toml
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();

  // See https://github.com/coral-xyz/anchor/issues/3122
  // const user = (provider.wallet as anchor.Wallet).payer;
  // const payer = user;

  const connection = provider.connection;

  const program = anchor.workspace.Escrow as Program<Escrow>;

  const [alice, bob, usdcMint, wifMint] = makeKeypairs(4);

  const [aliceUsdcAccount, aliceWifAccount, bobUsdcAccount, bobWifAccount] = [
    alice,
    bob,
  ].flatMap((owner) =>
    [usdcMint, wifMint].map((tokenMint) =>
      getAssociatedTokenAddressSync(
        tokenMint.publicKey,
        owner.publicKey,
        false,
        TOKEN_PROGRAM
      )
    )
  );

  // Pick a random ID for the new offer.
  const offerId = getRandomBigNumber();

  // Creates Alice and Bob accounts, 2 token mints, and associated token
  // accounts for both tokens for both users.
  beforeAll(async () => {
    // global.console = require('console');

    const giveAliceAndBobSolIxs: Array<TransactionInstruction> = [
      alice,
      bob,
    ].map((owner) =>
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: owner.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      })
    );

    const usdcSetupIxs = await createTokenAndMintTo(
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

    const wifSetupIxs = await createTokenAndMintTo(
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

    // Add all these instructions to our transaction
    let tx = new Transaction();
    tx.instructions = [
      ...giveAliceAndBobSolIxs,
      ...usdcSetupIxs,
      ...wifSetupIxs,
    ];

    const _setupTxSig = await provider.sendAndConfirm(tx, [
      alice,
      bob,
      usdcMint,
      wifMint,
    ]);
  });

  // afterAll(() => {
  //   global.console = jestConsole;
  // });

  const makeOfferTx = async (
    maker: Keypair,
    offerId: BN,
    offeredTokenMint: PublicKey,
    offeredAmount: BN,
    wantedTokenMint: PublicKey,
    wantedAmount: BN
  ): Promise<PublicKey> => {
    const transactionSignature = await program.methods
      .makeOffer(offerId, offeredAmount, wantedAmount)
      .accounts({
        maker: maker.publicKey,
        tokenMintA: offeredTokenMint,
        tokenMintB: wantedTokenMint,
        // As the `token_program` account is specified as
        //
        //   pub token_program: Interface<'info, TokenInterface>,
        //
        // the client library needs us to provide the specific program address
        // explicitly.
        //
        // This is unlike the `associated_token_program` or the `system_program`
        // account addresses, that are specified in the program IDL, as they are
        // expected to reference the same programs for all the `makeOffer`
        // invocations.
        tokenProgram: TOKEN_PROGRAM,
      })
      .signers([maker])
      .rpc();

    await confirmTransaction(connection, transactionSignature);

    // Both `offer` address and the `vault` address accounts are computed based
    // on the other provided account addresses, and so we do not need to provide
    // them explicitly in the `makeOffer()` account call above.  But we compute
    // them here and return for convenience.

    const [offerAddress, _offerBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        maker.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    

    return offerAddress;
  };

  const takeOfferTx = async (
    offerAddress: PublicKey,
    taker: Keypair,
  ): Promise<void> => {

    // `accounts` argument debugging tool.  Should be part of Anchor really.
    //
    // type FlatType<T> = T extends object
    //   ? { [K in keyof T]: FlatType<T[K]> }
    //   : T;
    //
    // type AccountsArgs = FlatType<
    //   Parameters<
    //     ReturnType<
    //       Program<Escrow>["methods"]["takeOffer"]
    //     >["accounts"]
    //   >
    // >;

    const transactionSignature = await program.methods
      .takeOffer()
      .accounts({
        taker: taker.publicKey,
        offer: offerAddress,
        // See note in the `makeOfferTx` on why this program address is provided
        // and the rest are not.
        tokenProgram: TOKEN_PROGRAM,
      })
      .signers([taker])
      .rpc();

    await confirmTransaction(connection, transactionSignature);
  };
  const checkApproval = async (
    connection: Connection,
    makerTokenAccount: PublicKey,
    offer: PublicKey
  ): Promise<{ isApproved: boolean; delegatedAmount?: number }> => {
    const tokenAccountInfo = await connection.getAccountInfo(makerTokenAccount);
  
    if (!tokenAccountInfo) {
      throw new Error('Token account not found');
    }
    
    const tokenAccount = AccountLayout.decode(tokenAccountInfo.data);
    
    const isApproved = new PublicKey(tokenAccount.delegate).toString() === offer.toString();
    
    const delegatedAmount = tokenAccount.delegatedAmount?.toString() 
      ? parseInt(tokenAccount.delegatedAmount.toString()) 
      : undefined;
  
    return {
      isApproved,
      delegatedAmount
    };
  };
  test("Offer created by Alice", async () => {
    const offeredUsdc = new BN(10_000_000);
    const wantedWif = new BN(100_000_000);

    const getTokenBalance = getTokenBalanceOn(connection);

    const offerAddress = await makeOfferTx(
      alice,
      offerId,
      usdcMint.publicKey,
      offeredUsdc,
      wifMint.publicKey,
      wantedWif
    );
    const {isApproved, delegatedAmount} = await checkApproval(
      connection,
      aliceUsdcAccount,
      offerAddress
    );

    expect(isApproved).toBe(true);
    expect(new BN(delegatedAmount)).toEqual(offeredUsdc);
    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(100_000_000));
    const offerAccount = await program.account.offer.fetch(offerAddress);
    expect(offerAccount.maker).toEqual(alice.publicKey);
    expect(offerAccount.tokenMintA).toEqual(usdcMint.publicKey);
    expect(offerAccount.tokenMintB).toEqual(wifMint.publicKey);
    expect(offerAccount.tokenBWantedAmount).toEqual(wantedWif);
  });

  test("Offer taken by Bob, tokens balances are updated", async () => {
    const getTokenBalance = getTokenBalanceOn(connection);

    // This test reuses offer created by the previous test.  Bad design :(
    // But it is a shortcut that allows us to avoid writing the cleanup code.
    // TODO Add proper cleanup, that mirrors `beforeEach`, and create a new
    // offer here.

    const [offerAddress, _offerBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        alice.publicKey.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Verify state before the offer is taken.

    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(100_000_000));
    expect(await getTokenBalance(aliceWifAccount)).toEqual(new BN(5_000_000));
    expect(await getTokenBalance(bobUsdcAccount)).toEqual(new BN(20_000_000));
    expect(await getTokenBalance(bobWifAccount)).toEqual(new BN(300_000_000));

    await takeOfferTx(offerAddress, bob);

    expect(await getTokenBalance(aliceUsdcAccount)).toEqual(new BN(90_000_000));
    expect(await getTokenBalance(aliceWifAccount)).toEqual(new BN(105_000_000));

    expect(await getTokenBalance(bobUsdcAccount)).toEqual(new BN(30_000_000));
    expect(await getTokenBalance(bobWifAccount)).toEqual(new BN(200_000_000));
  });
  test("Fail to take offer if maker spends delegated tokens", async () => {

    const badOfferId = getRandomBigNumber();
    const offeredUsdc = new BN(10_000_000);
    const wantedWif  = new BN(100_000_000);
  

    const offerAddress = await makeOfferTx(
      alice,
      badOfferId,
      usdcMint.publicKey,
      offeredUsdc,
      wifMint.publicKey,
      wantedWif
    );
  

    const transferIx = createTransferCheckedInstruction(
      aliceUsdcAccount,              
      usdcMint.publicKey,            
      bobUsdcAccount,             
      alice.publicKey,              
      81_000_000,                    
      6,                            
      [],                           
      TOKEN_PROGRAM                  
    );
    await provider.sendAndConfirm(
      new Transaction().add(transferIx),
      [alice]
    );
  
    await expect(
      takeOfferTx(offerAddress, bob)
    ).rejects.toThrow(/InsufficientBalance/);
  });

  test("Maker can close offer, vault and offer accounts are closed, tokens and SOL returned", async () => {
    const offeredUsdc = new BN(10_000_000);
    const wantedWif = new BN(100_000_000);
  
    // Створюємо новий офер для цього тесту
    const closeOfferId = getRandomBigNumber();
    const offerAddress = await makeOfferTx(
      alice,
      closeOfferId,
      usdcMint.publicKey,
      offeredUsdc,
      wifMint.publicKey,
      wantedWif
    );
  
    // Вираховуємо адресу vault
    const [vaultAddress, _vaultBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vault"),
        offerAddress.toBuffer(),
      ],
      program.programId
    );
  
    const getTokenBalance = getTokenBalanceOn(connection);
  
    // Баланси Alice до закриття оферу
    const aliceUsdcBefore = await getTokenBalance(aliceUsdcAccount);
    const aliceSolBefore = await connection.getBalance(alice.publicKey);
  
    // Закриваємо офер
    const txSig = await program.methods
      .closeOffer()
      .accounts({
        offer: offerAddress,
        maker: alice.publicKey,
        vault: vaultAddress,
        makerTokenAccount: aliceUsdcAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([alice])
      .rpc();
  
    await confirmTransaction(connection, txSig);
  
    // Vault акаунт має бути закритий
    const vaultInfo = await connection.getAccountInfo(vaultAddress);
    expect(vaultInfo).toBeNull();
  
    // Офер акаунт має бути закритий
    const offerInfo = await connection.getAccountInfo(offerAddress);
    expect(offerInfo).toBeNull();
  
    // Токени повернулись Alice (має бути +offeredUsdc)
    const aliceUsdcAfter = await getTokenBalance(aliceUsdcAccount);
    expect(aliceUsdcAfter.sub(aliceUsdcBefore)).toEqual(offeredUsdc);
  
    // SOL за ренту vault повернувся Alice (перевіряємо що стало більше)
    const aliceSolAfter = await connection.getBalance(alice.publicKey);
    expect(aliceSolAfter).toBeGreaterThanOrEqual(aliceSolBefore); // невелика похибка можлива на fee
  });
  
});