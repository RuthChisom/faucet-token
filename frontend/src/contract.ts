export const FAUCET_TOKEN_ADDRESS = "0x9C745Fa4354e02129190FdC29973CE0178494324";

export const FAUCET_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function lastClaim(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function requestToken() nonpayable",
  "function mint(address,uint256) nonpayable",
  "function transfer(address,uint256) nonpayable returns (bool)",
  "event FaucetClaimed(address indexed account, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
