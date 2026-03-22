import { useState, useEffect, useCallback } from "react";
import { ethers, BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI } from "./contract";

// Types
interface TokenInfo {
  name: string;
  symbol: string;
  totalSupply: string;
  userBalance: string;
  ownerAddress: string;
  lastClaimTime: number;
}

// Countdown Hook
function useCountdown(targetTime: number) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      if (targetTime === 0) {
        setTimeLeft(0);
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTime + 86400 - now; // 24 hours = 86400 seconds
      setTimeLeft(diff > 0 ? diff : 0);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetTime]);

  if (timeLeft <= 0) return null;

  const hours = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;

  return `Retry in ${hours} hours ${mins} mins ${secs} secs`;
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const countdown = useCountdown(tokenInfo?.lastClaimTime || 0);

  // Auto-connect on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const p = new ethers.BrowserProvider(window.ethereum);
          const accounts = await p.send("eth_accounts", []);
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setProvider(p);
          }
        } catch (err) {
          console.error("Error checking connection:", err);
        }
      }
    };
    checkConnection();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const p = new ethers.BrowserProvider(window.ethereum);
        const accounts = await p.send("eth_requestAccounts", []);
        setAccount(accounts[0]);
        setProvider(p);
      } catch (err) {
        setError("Failed to connect wallet");
      }
    } else {
      setError("Please install MetaMask");
    }
  };

  const fetchTokenInfo = useCallback(async () => {
    if (!provider || !account) return;

    try {
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, provider);
      const [name, symbol, totalSupply, userBalance, ownerAddress, lastClaimTime] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.totalSupply(),
        contract.balanceOf(account),
        contract.owner(),
        contract.lastClaim(account)
      ]);

      setTokenInfo({
        name,
        symbol,
        totalSupply: formatUnits(totalSupply, 18),
        userBalance: formatUnits(userBalance, 18),
        ownerAddress: ownerAddress.toLowerCase(),
        lastClaimTime: Number(lastClaimTime)
      });
    } catch (err) {
      console.error(err);
      setError("Error fetching token info. Is the contract deployed?");
    }
  }, [provider, account]);

  useEffect(() => {
    if (account && provider) fetchTokenInfo();
  }, [account, provider, fetchTokenInfo]);

  const handleRequestToken = async () => {
    if (!provider || !account) return;
    setLoading(true);
    setError(null);
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      const tx = await contract.requestToken();
      await tx.wait();
      await fetchTokenInfo();
    } catch (err: any) {
      setError(err.reason || "Faucet request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!provider || !account) return;
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      const tx = await contract.mint(mintTo, parseUnits(mintAmount, 18));
      await tx.wait();
      await fetchTokenInfo();
      setMintTo("");
      setMintAmount("");
    } catch (err: any) {
      setError(err.reason || "Minting failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!provider || !account) return;
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      const tx = await contract.transfer(transferTo, parseUnits(transferAmount, 18));
      await tx.wait();
      await fetchTokenInfo();
      setTransferTo("");
      setTransferAmount("");
    } catch (err: any) {
      setError(err.reason || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = account && tokenInfo?.ownerAddress === account.toLowerCase();

  return (
    <div>
      <h1>{tokenInfo?.name || "FaucetToken"}</h1>
      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p><strong>Connected Account:</strong> {account}</p>
          
          {tokenInfo ? (
            <div className="card">
              <p><strong>Symbol:</strong> {tokenInfo.symbol}</p>
              <p><strong>Total Supply:</strong> {tokenInfo.totalSupply}</p>
              <p><strong>Your Balance:</strong> {tokenInfo.userBalance} {tokenInfo.symbol}</p>
              <p><strong>Last Claim Time:</strong> {tokenInfo.lastClaimTime === 0 ? "Never" : new Date(tokenInfo.lastClaimTime * 1000).toLocaleString()}</p>
            </div>
          ) : (
            <p>Loading token info...</p>
          )}

          <div className="card">
            <h3>Faucet</h3>
            {countdown ? (
              <p className="error">{countdown}</p>
            ) : (
              <button onClick={handleRequestToken} disabled={loading}>
                {loading ? "Requesting..." : "Claim 100 FCT"}
              </button>
            )}
          </div>

          <div className="card">
            <h3>Transfer</h3>
            <input 
              placeholder="Recipient Address (0x...)" 
              value={transferTo} 
              onChange={(e) => setTransferTo(e.target.value)} 
            />
            <input 
              placeholder="Amount" 
              type="number" 
              value={transferAmount} 
              onChange={(e) => setTransferAmount(e.target.value)} 
            />
            <button onClick={handleTransfer} disabled={loading || !transferTo || !transferAmount}>
              Transfer
            </button>
          </div>

          {isOwner && (
            <div className="card" style={{borderColor: "#007bff"}}>
              <h3>Mint (Owner Only)</h3>
              <input 
                placeholder="To Address (0x...)" 
                value={mintTo} 
                onChange={(e) => setMintTo(e.target.value)} 
              />
              <input 
                placeholder="Amount" 
                type="number" 
                value={mintAmount} 
                onChange={(e) => setMintAmount(e.target.value)} 
              />
              <button onClick={handleMint} disabled={loading || !mintTo || !mintAmount}>
                Mint
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="error" style={{marginTop: "20px", fontWeight: "bold"}}>Error: {error}</p>}
    </div>
  );
}

export default App;
