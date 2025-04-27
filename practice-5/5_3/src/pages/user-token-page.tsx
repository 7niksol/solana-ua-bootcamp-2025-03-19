import { useEffect, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { TokenList } from "@/components/TokenList";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export default function UserTokensPage() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<{ mint: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet?.publicKey) return;
    setLoading(true);

    (async () => {

      const accounts = await connection.getParsedTokenAccountsByOwner(
        wallet.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      const tokens = accounts.value
        .map((acc) => {
          const info = acc.account.data.parsed.info;
          return {
            mint: info.mint,
            amount: Number(info.tokenAmount.amount),
          };
        })
        .filter((t) => t.amount > 0);
      setTokens(tokens);
      setLoading(false);
    })();
  }, [wallet, connection]);

  if (!wallet?.publicKey) return <div className="p-4">Connect your wallet</div>;
  if (loading) return <div className="p-4">Loading tokens...</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Your Token-2022 Accounts</h2>
      <TokenList tokens={tokens} />
    </div>
  );
}