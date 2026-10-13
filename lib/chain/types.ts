import type { Address, Hex } from "viem";

export type DocumentKind = "TENANCY_AGREEMENT" | "PROPERTY_RECORD";

export type RegistryRecord = {
  docHash: Hex;
  creator: Address;
  createdAt: number; // unix seconds
  fullySignedAt: number; // 0 when not fully signed
  kind: string;
  parties: Address[];
  signed: boolean[];
  source: "chain" | "demo";
};

export type TxResult = { hash: string; source: "chain" | "demo" };

/** Everything the UI needs from a registry, whether real (Sepolia) or simulated (Demo Mode). */
export interface RegistryBackend {
  readonly source: "chain" | "demo";
  /** Address of the account that will send transactions, if connected. */
  account(): Address | null;
  register(docHash: Hex, kind: DocumentKind, parties: Address[]): Promise<TxResult>;
  sign(docHash: Hex): Promise<TxResult>;
  getRecord(docHash: Hex): Promise<RegistryRecord | null>;
}
