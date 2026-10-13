import { describe, expect, it } from "vitest";
import { loadDocuments, saveDocument, type SavedDocument } from "./storage";

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const doc = (hash: string): SavedDocument => ({
  kind: "PROPERTY_RECORD",
  hash,
  text: "t",
  createdAt: "2026-10-20T10:00:00Z",
  source: "demo",
  record: {
    registrantName: "A",
    registrantWallet: "0x0000000000000000000000000000000000007e01",
    propertyDescription: "p",
    documentsHeld: "d",
    whereKept: "w",
    hasWill: false,
    willSummary: "",
    recordDate: "2026-10-20",
  },
});

describe("saved documents", () => {
  it("saves newest first and replaces the same hash", () => {
    const storage = memory();
    saveDocument(doc("0x1"), storage);
    saveDocument(doc("0x2"), storage);
    saveDocument(doc("0x1"), storage);
    expect(loadDocuments(storage).map((d) => d.hash)).toEqual(["0x1", "0x2"]);
  });
  it("survives bad stored data and missing storage", () => {
    const storage = memory();
    storage.setItem("courtagent.documents.v1", "not json");
    expect(loadDocuments(storage)).toEqual([]);
    expect(loadDocuments(null)).toEqual([]);
  });
});
