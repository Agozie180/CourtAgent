/**
 * Share links carry the document text in the URL fragment (#d=...). Browsers never send the fragment to a
 * server, so the text stays private. The page recomputes the hash from the text and checks it on-chain.
 */

export function encodeShareText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeShareText(encoded: string): string | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.length > 0 && text.length <= 20_000 ? text : null;
  } catch {
    return null;
  }
}

/**
 * The verify link for a document. When the record is on Ethereum Sepolia the link says so (`&net=sepolia`), so the person
 * who opens it in a fresh browser is looking at the same registry and not at their own empty Demo Mode.
 */
export function buildVerifyPath(text: string, network?: "sepolia" | "demo"): string {
  return `/verify#d=${encodeShareText(text)}${network === "sepolia" ? "&net=sepolia" : ""}`;
}

export function readShareFromHash(hash: string): string | null {
  const match = hash.match(/(?:^#|&)d=([A-Za-z0-9_-]+)/);
  return match ? decodeShareText(match[1]) : null;
}

/** "sepolia" when the link was made for the Sepolia registry, otherwise null. */
export function readShareNetwork(hash: string): "sepolia" | null {
  return /(?:^#|&)net=sepolia(?:&|$)/.test(hash) ? "sepolia" : null;
}
