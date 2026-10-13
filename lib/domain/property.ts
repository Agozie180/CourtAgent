import { DISCLAIMER } from "./lagos-tenancy";

export type PropertyRecordInput = {
  registrantName: string; // the person registering, for example the husband or the couple
  registrantWallet: string;
  propertyDescription: string; // for example "Family house, 4 Bode Street, Surulere"
  documentsHeld: string; // for example "Deed of assignment dated 2015; survey plan; receipts"
  whereKept: string; // where the originals are kept
  hasWill: boolean;
  willSummary: string; // short, no secrets; optional
  recordDate: string; // YYYY-MM-DD
};

export function validatePropertyRecord(input: Partial<PropertyRecordInput>): string[] {
  const issues: string[] = [];
  if (!input.registrantName?.trim()) issues.push("Enter the name of the person registering.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.registrantWallet ?? "")) issues.push("Enter a valid wallet address.");
  if (!input.propertyDescription?.trim()) issues.push("Describe the property.");
  if (!input.documentsHeld?.trim()) issues.push("List the documents you hold for the property.");
  if (!input.whereKept?.trim()) issues.push("Say where the original documents are kept.");
  if (!input.recordDate) issues.push("Enter the record date.");
  return issues;
}

/** Deterministic text. Only its hash goes on-chain; keep the text itself somewhere safe. */
export function buildPropertyRecord(input: PropertyRecordInput): string {
  const will = input.hasWill
    ? `Yes.${input.willSummary.trim() ? ` Summary: ${input.willSummary.trim()}` : ""}`
    : "No will has been made.";
  return `PROPERTY RECORD

Prepared with CourtAgent. The text of this record is kept privately; only its hash is registered on the Ethereum Sepolia test network.

Registered by: ${input.registrantName.trim()} (wallet ${input.registrantWallet})
Date of record: ${input.recordDate}

Property: ${input.propertyDescription.trim()}
Documents held: ${input.documentsHeld.trim()}
Original documents kept at: ${input.whereKept.trim()}
Will: ${will}

Anyone holding a copy of this exact text can hash it and check it against the on-chain record. If any word is changed, the hash will no longer match. This record shows what was declared on the date above. It does not by itself prove ownership.

${DISCLAIMER}`;
}
