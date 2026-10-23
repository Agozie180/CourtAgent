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

function isSavedDocument(value: unknown): value is SavedDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Record<string, unknown>;
  const body = doc.kind === "TENANCY_AGREEMENT" ? doc.terms : doc.kind === "PROPERTY_RECORD" ? doc.record : null;
  return (
    typeof doc.hash === "string" &&
    typeof doc.text === "string" &&
    typeof doc.createdAt === "string" &&
    (doc.source === "chain" || doc.source === "demo") &&
    typeof body === "object" &&
    body !== null
  );
}

/** Saved documents from browser storage. Anything that is not a well-formed document (a corrupted or hand-edited entry) is dropped. */
export function parseDocuments(raw: string): SavedDocument[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSavedDocument) : [];
  } catch {
    return [];
  }
}

/** The stored JSON text. A string is a stable snapshot for useSyncExternalStore. */
export function readDocumentsRaw(storage: StorageLike | null = defaultStorage()): string {
  try {
    return storage?.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function loadDocuments(storage: StorageLike | null = defaultStorage()): SavedDocument[] {
  return parseDocuments(readDocumentsRaw(storage));
}

const listeners = new Set<() => void>();

/** Calls back when a document is saved here or in another tab. */
export function subscribeDocuments(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) onChange();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function saveDocument(doc: SavedDocument, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  const others = loadDocuments(storage).filter((existing) => existing.hash !== doc.hash);
  try {
    storage.setItem(KEY, JSON.stringify([doc, ...others].slice(0, 30)));
    listeners.forEach((listener) => listener());
  } catch {
    /* storage full or blocked: the document can still be copied from the screen */
  }
}
