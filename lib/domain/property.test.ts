import { describe, expect, it } from "vitest";
import { buildPropertyRecord, validatePropertyRecord, type PropertyRecordInput } from "./property";

const input: PropertyRecordInput = {
  registrantName: "Emeka Okoro",
  registrantWallet: "0x0000000000000000000000000000000000007e01",
  propertyDescription: "Family house, 4 Bode Street, Surulere, Lagos",
  documentsHeld: "Deed of assignment (2015), survey plan, receipts",
  whereKept: "Fireproof box at home; copy with a lawyer",
  hasWill: true,
  willSummary: "House to my wife for her lifetime, then to our children",
  recordDate: "2026-10-20",
};

describe("property record", () => {
  it("validates required fields", () => {
    expect(validatePropertyRecord(input)).toEqual([]);
    expect(validatePropertyRecord({ ...input, registrantName: "", registrantWallet: "abc" })).toHaveLength(2);
  });
  it("is deterministic and states what it does not prove", () => {
    const text = buildPropertyRecord(input);
    expect(buildPropertyRecord(input)).toBe(text);
    expect(text).toContain("Surulere");
    expect(text).toContain("does not by itself prove ownership");
    expect(text).toContain("Summary: House to my wife");
    expect(buildPropertyRecord({ ...input, hasWill: false })).toContain("No will has been made.");
  });
});
