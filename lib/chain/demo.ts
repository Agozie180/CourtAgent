import { getAddress, isAddress, keccak256, toBytes, type Address, type Hex } from "viem";
import type { DocumentKind, RegistryBackend, RegistryRecord, TxResult } from "./types";

/**
 * Demo Mode registry. It mirrors the rules of contracts/DocumentRegistry.sol but keeps its data in the
 * browser's storage, so the whole product can be tried with no wallet and no test ETH.
 * Everything it produces is labelled "Demo" in the UI and is NOT on any blockchain.
 */

export const DEMO_STORAGE_KEY = "courtagent.demo-ledger.v1";
const MAX_PARTIES = 8;
const MAX_KIND_LENGTH = 64;

type StoredRecord = Omit<RegistryRecord, "source">;
export type DemoState = { counter: number; records: Record<string, StoredRecord> };

export const emptyDemoState = (): DemoState => ({ counter: 0, records: {} });

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadDemoState(storage: StorageLike | null): DemoState {
  if (!storage) return emptyDemoState();
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return emptyDemoState();
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || typeof parsed.counter !== "number" || typeof parsed.records !== "object") return emptyDemoState();
    return parsed;
  } catch {
    return emptyDemoState();
  }
}

function save(storage: StorageLike | null, state: DemoState) {
  try {
    storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage can be unavailable (private mode); Demo Mode then lasts for the page session only */
  }
}

function fakeTxHash(state: DemoState, label: string): Hex {
  return keccak256(toBytes(`demo:${state.counter}:${label}`));
}

export class DemoError extends Error {}

export function applyRegister(
  state: DemoState,
  creator: Address,
  docHash: Hex,
  kind: string,
  parties: Address[],
  nowSeconds: number,
): TxResult {
  if (/^0x0{64}$/.test(docHash)) throw new DemoError("EmptyHash");
  if (kind.length === 0 || kind.length > MAX_KIND_LENGTH) throw new DemoError("InvalidKind");
  if (parties.length === 0 || parties.length > MAX_PARTIES) throw new DemoError("InvalidParties");
  const normalized = parties.map((party) => {
    if (!isAddress(party)) throw new DemoError("InvalidParties");
    return getAddress(party);
  });
  if (new Set(normalized).size !== normalized.length) throw new DemoError("InvalidParties");
  if (state.records[docHash]) throw new DemoError("AlreadyRegistered");

  state.counter += 1;
  state.records[docHash] = {
    docHash,
    creator: getAddress(creator),
    createdAt: nowSeconds,
    fullySignedAt: 0,
    kind,
    parties: normalized,
    signed: normalized.map(() => false),
  };
  return { hash: fakeTxHash(state, `register:${docHash}`), source: "demo" };
}

export function applySign(state: DemoState, signer: Address, docHash: Hex, nowSeconds: number): TxResult {
  const record = state.records[docHash];
  if (!record) throw new DemoError("NotRegistered");
  const index = record.parties.findIndex((party) => party === getAddress(signer));
  if (index === -1) throw new DemoError("NotAParty");
  if (record.signed[index]) throw new DemoError("AlreadySigned");

  state.counter += 1;
  record.signed[index] = true;
  if (record.signed.every(Boolean)) record.fullySignedAt = nowSeconds;
  return { hash: fakeTxHash(state, `sign:${docHash}:${signer}`), source: "demo" };
}

export class DemoRegistry implements RegistryBackend {
  readonly source = "demo" as const;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly getActor: () => Address | null,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  account(): Address | null {
    return this.getActor();
  }

  async register(docHash: Hex, kind: DocumentKind, parties: Address[]): Promise<TxResult> {
    const actor = this.requireActor();
    const state = loadDemoState(this.storage);
    const result = applyRegister(state, actor, docHash, kind, parties, this.now());
    save(this.storage, state);
    return result;
  }

  async sign(docHash: Hex): Promise<TxResult> {
    const actor = this.requireActor();
    const state = loadDemoState(this.storage);
    const result = applySign(state, actor, docHash, this.now());
    save(this.storage, state);
    return result;
  }

  async getRecord(docHash: Hex): Promise<RegistryRecord | null> {
    const record = loadDemoState(this.storage).records[docHash];
    return record ? { ...record, source: "demo" } : null;
  }

  private requireActor(): Address {
    const actor = this.getActor();
    if (!actor) throw new DemoError("Choose who you are acting as first.");
    return actor;
  }
}

/** Fixed, clearly fake addresses used for the sides of a Demo Mode rental. */
export const DEMO_TENANT: Address = "0x0000000000000000000000000000000000007e01";
export const DEMO_LANDLORD: Address = "0x000000000000000000000000000000000001a2d1";
export const DEMO_OWNER: Address = "0x000000000000000000000000000000000000b0b1";
