import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { createAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI } from "./contract";

// 1. Get projectId from https://cloud.reown.com
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "YOUR_PROJECT_ID";

// 2. Set networks
const liskSepolia = {
  id: 4202,
  name: "Lisk Sepolia",
  network: "lisk-sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia-api.lisk.com"] },
    public: { http: ["https://rpc.sepolia-api.lisk.com"] },
  },
  blockExplorers: {
    default: { name: "LiskScan", url: "https://sepolia-blockscout.lisk.com" },
  },
};

// 3. Create AppKit
createAppKit({
  adapters: [new EthersAdapter()],
  networks: [liskSepolia],
  projectId,
  features: {
    analytics: true
  }
});

// Types
interface TokenInfo {
  name: string;
  description: string;
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
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const countdown = useCountdown(tokenInfo?.lastClaimTime || 0);

  const fetchTokenInfo = useCallback(async () => {
    if (!walletProvider || !address) return;

    try {
      const provider = new BrowserProvider(walletProvider as any);
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(liskSepolia.id)) {
        setError(`Wrong network! Please switch to Lisk Sepolia (Chain ID ${liskSepolia.id})`);
        return;
      }

      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, provider);
      
      const [name, description, symbol, totalSupply, userBalance, ownerAddress, lastClaimTime] = await Promise.all([
        contract.name(),
        contract.description(),
        contract.symbol(),
        contract.totalSupply(),
        contract.balanceOf(address),
        contract.owner(),
        contract.lastClaim(address)
      ]);

      setTokenInfo({
        name,
        description,
        symbol,
        totalSupply: formatUnits(totalSupply, 18),
        userBalance: formatUnits(userBalance, 18),
        ownerAddress: ownerAddress.toLowerCase(),
        lastClaimTime: Number(lastClaimTime)
      });
      setError(null);
    } catch (err: any) {
      console.error("Fetch Error:", err);
      setError(`Error fetching token info: ${err.message || err.reason || "Unknown error"}`);
    }
  }, [walletProvider, address]);

  useEffect(() => {
    if (isConnected && walletProvider && address) {
      fetchTokenInfo();
    } else {
      setTokenInfo(null);
    }
  }, [isConnected, walletProvider, address, fetchTokenInfo]);

  const handleRequestToken = async () => {
    if (!walletProvider || !address) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      
      console.log("Requesting token...");
      const tx = await contract.requestToken();
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed");
      await fetchTokenInfo();
    } catch (err: any) {
      console.error("RequestToken Error:", err);
      setError(err.reason || err.message || "Faucet request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!walletProvider || !address) return;
    if (!mintTo || !mintAmount) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      
      console.log(`Minting ${mintAmount} to ${mintTo}`);
      const tx = await contract.mint(mintTo, parseUnits(mintAmount.toString(), 18));
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      await fetchTokenInfo();
      setMintTo("");
      setMintAmount("");
    } catch (err: any) {
      console.error("Mint Error:", err);
      setError(err.reason || err.message || "Minting failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!walletProvider || !address) return;
    if (!transferTo || !transferAmount) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const contract = new Contract(FAUCET_TOKEN_ADDRESS, FAUCET_TOKEN_ABI, signer);
      
      console.log(`Transferring ${transferAmount} to ${transferTo}`);
      const tx = await contract.transfer(transferTo, parseUnits(transferAmount.toString(), 18));
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      await fetchTokenInfo();
      setTransferTo("");
      setTransferAmount("");
    } catch (err: any) {
      console.error("Transfer Error:", err);
      setError(err.reason || err.message || "Transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const isOwner = address && tokenInfo?.ownerAddress === address.toLowerCase();

  return (
    <div>
      <h1>{tokenInfo?.name || "FaucetToken"}</h1>
      <h5>{tokenInfo?.description || "Request FCT Tokens Hassle Free"}</h5>
      
      <div style={{ marginBottom: "20px" }}>
        <appkit-button />
      </div>

      {isConnected && (
        <div>
          <p><strong>Connected Account:</strong> {address}</p>
          
          {tokenInfo ? (
            <div className="card">
              <p><strong>Symbol:</strong> {tokenInfo.symbol}</p>
              <p><strong>Total Supply:</strong> {tokenInfo.totalSupply}</p>
              <p><strong>Your Balance:</strong> {tokenInfo.userBalance} {tokenInfo.symbol}</p>
              <p><strong>Last Claim Time:</strong> {tokenInfo.lastClaimTime === 0 ? "Never" : new Date(tokenInfo.lastClaimTime * 1000).toLocaleString()}</p>
            </div>
          ) : (
            !error && <p>Loading token info...</p>
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
