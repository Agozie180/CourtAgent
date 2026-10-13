import { sepolia } from "viem/chains";
import type { Address } from "viem";

export const CHAIN = sepolia;
export const CHAIN_NAME = "Ethereum Sepolia";
export const EXPLORER = "https://sepolia.etherscan.io";

export const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

export function getRegistryAddress(): Address | null {
  const value = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}
