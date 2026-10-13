import type { TenancyTerms } from "@/lib/domain/agreement";
import type { PropertyRecordInput } from "@/lib/domain/property";

/** What CourtAgent remembers in this browser. The agreement text itself never goes on-chain or to a server. */
export type SavedDocument =
  | {
      kind: "TENANCY_AGREEMENT";
      hash: string;
      text: string;
      createdAt: string; // ISO timestamp
      source: "chain" | "demo";
      terms: TenancyTerms;
    }
  | {
      kind: "PROPERTY_RECORD";
      hash: string;
      text: string;
      createdAt: string;
      source: "chain" | "demo";
      record: PropertyRecordInput;
    };

const KEY = "courtagent.documents.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadDocuments(storage: StorageLike | null = defaultStorage()): SavedDocument[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedDocument[]) : [];
  } catch {
    return [];
  }
}

export function saveDocument(doc: SavedDocument, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const others = loadDocuments(storage).filter((existing) => existing.hash !== doc.hash);
  try {
    storage.setItem(KEY, JSON.stringify([doc, ...others].slice(0, 30)));
  } catch {
    /* storage full or blocked: the document can still be copied from the screen */
  }
}
