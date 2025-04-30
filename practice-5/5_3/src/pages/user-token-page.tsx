import { useEffect, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { TokenList } from "@/components/TokenList";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export default function UserTokensPage() {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [tokens, setTokens] = useState<{ mint: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet?.publicKey) return;
    setLoading(true);

    (async () => {
      try {
        console.log("Fetching token accounts...");
        
        // Получаем токены для TOKEN_2022_PROGRAM_ID
        const accounts2022 = await connection.getParsedTokenAccountsByOwner(
          wallet.publicKey,
          { programId: TOKEN_2022_PROGRAM_ID }
        );
        console.log("Accounts from TOKEN_2022_PROGRAM_ID:", accounts2022.value);

        // Получаем токены для стандартного TOKEN_PROGRAM_ID
        const accountsStandard = await connection.getParsedTokenAccountsByOwner(
          wallet.publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );
        console.log("Accounts from TOKEN_PROGRAM_ID:", accountsStandard.value);

        if (accounts2022.value.length === 0 && accountsStandard.value.length === 0) {
          console.log("No token accounts found for this wallet.");
        }

        const allAccounts = [...accounts2022.value, ...accountsStandard.value];
        console.log("Combined accounts:", allAccounts);

        const tokens = allAccounts
          .map((acc) => {
            const info = acc.account.data.parsed.info;
            return {
              mint: info.mint,
              amount: Number(info.tokenAmount.amount),
            };
          })
          .filter((t) => t.amount > 0);

        console.log("Filtered tokens:", tokens);

        setTokens(tokens);
      } catch (error) {
        console.error("Error fetching tokens:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [wallet, connection]);

  if (!wallet?.publicKey) return <div className="p-4">Connect your wallet</div>;
  if (loading) return <div className="p-4">Loading tokens...</div>;

  if (tokens.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Your Token Accounts</h2>
        <div>No tokens found</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Your Token Accounts</h2>
      <TokenList tokens={tokens} />
    </div>
  );
}