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

/**
 * Why a typed fingerprint cannot be looked up, in plain words, or null when it is a valid one
 * (0x followed by exactly 64 hexadecimal characters).
 */
export function hashProblem(value: string): string | null {
  const text = value.trim();
  if (text === "") return null;
  if (!/^0x/i.test(text)) return "A fingerprint starts with 0x. Copy the whole line, including the 0x.";
  if (!text.startsWith("0x")) return "Write the start as a small 0x, not 0X.";
  const digits = text.slice(2);
  if (/[^0-9a-fA-F]/.test(digits)) return "A fingerprint uses only the digits 0 to 9 and the letters a to f after the 0x. Check for a stray space, quote or other character.";
  if (digits.length !== 64) return `A fingerprint has 64 characters after the 0x. This one has ${digits.length}. Copy the whole fingerprint.`;
  return null;
}
