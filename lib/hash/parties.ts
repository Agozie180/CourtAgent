import { getAddress, type Address } from "viem";

/**
 * A recorded hash proves WHAT was recorded. It does not, by itself, prove that the right people recorded it.
 * Every CourtAgent document writes its wallets into the text, so the verify page can compare the wallets named
 * in the text with the parties stored in the registry. A mismatch is shown as a warning (AUDIT.md, F-2).
 */

export type PartyCheck = {
  status: "match" | "mismatch" | "none";
  /** Wallets written in the document text. */
  inText: Address[];
  /** Parties in the registry that the text does not name. */
  onChainOnly: Address[];
  /** Wallets named in the text that are not parties in the registry. */
  textOnly: Address[];
};

export function addressesInText(text: string): Address[] {
  const found = text.match(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g) ?? [];
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const raw of found) {
    const address = getAddress(raw.toLowerCase());
    if (!seen.has(address)) {
      seen.add(address);
      out.push(address);
    }
  }
  return out;
}

export function comparePartiesToText(text: string, parties: readonly string[]): PartyCheck {
  const inText = addressesInText(text);
  const onChain = parties.map((party) => getAddress(party.toLowerCase()));
  if (inText.length === 0) return { status: "none", inText, onChainOnly: [], textOnly: [] };
  const onChainOnly = onChain.filter((party) => !inText.includes(party));
  const textOnly = inText.filter((address) => !onChain.includes(address));
  return {
    status: onChainOnly.length === 0 && textOnly.length === 0 ? "match" : "mismatch",
    inText,
    onChainOnly,
    textOnly,
  };
}
