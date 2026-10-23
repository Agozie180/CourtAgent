import { isAddress } from "viem";

/**
 * A real address. A mixed-case address must also carry a correct checksum, which catches most typing mistakes before
 * a signature or a transaction is involved. An all-lowercase address has no checksum to check and is accepted.
 */
export function isWalletAddress(value: unknown): value is string {
  return typeof value === "string" && isAddress(value.trim());
}

/** True when both are strings that name the same wallet, ignoring case and surrounding spaces. */
export function sameWallet(a: unknown, b: unknown): boolean {
  return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const walletMessage = (label: string): string =>
  `${label} must be a valid 0x address (42 characters). If it mixes capital and small letters, check it for typing mistakes.`;
