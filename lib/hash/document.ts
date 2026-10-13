import { keccak256, toBytes, type Hex } from "viem";

/**
 * Canonical form used before hashing, so harmless differences (Windows line endings,
 * trailing spaces, extra blank lines at the ends) never change a document's hash.
 * Any real change to the words does change the hash.
 */
export function canonicalizeDocument(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export function hashDocument(text: string): Hex {
  return keccak256(toBytes(canonicalizeDocument(text)));
}

export function isDocHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

export function shortHash(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : hash;
}
