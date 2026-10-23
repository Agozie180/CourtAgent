import { sepolia } from "viem/chains";
import type { Address } from "viem";
import deployment from "../../deployments/sepolia.json";

export const CHAIN = sepolia;
export const CHAIN_NAME = "Ethereum Sepolia";
export const EXPLORER = "https://sepolia.etherscan.io";

/** Public Sepolia endpoints tried in order after the one you configure, so one busy node does not take the verify page down. */
const PUBLIC_RPC_URLS = ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org", "https://1rpc.io/sepolia"];

export function rpcUrls(): string[] {
  const configured = (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "").trim();
  return [...new Set([...(configured ? [configured] : []), ...PUBLIC_RPC_URLS])];
}

/** The first RPC URL, used when a wallet has to be told where Sepolia is. */
export const RPC_URL = (process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "").trim() || PUBLIC_RPC_URLS[0];

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The registry contract. `NEXT_PUBLIC_REGISTRY_ADDRESS` wins when it is set. When it is empty, the address in the
 * committed `deployments/sepolia.json` is used, so a fresh clone can read and verify real Sepolia records with no setup.
 * A value that is set but is not an address turns the chain off instead of silently using another contract.
 */
export function getRegistryAddress(): Address | null {
  const value = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "").trim();
  if (value) return ADDRESS.test(value) ? (value as Address) : null;
  const committed = typeof deployment?.address === "string" ? deployment.address : "";
  return deployment?.chainId === CHAIN.id && ADDRESS.test(committed) ? (committed as Address) : null;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
