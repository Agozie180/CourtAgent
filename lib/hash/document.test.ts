import { describe, expect, it } from "vitest";
import { canonicalizeDocument, hashDocument, isDocHash, shortHash } from "./document";

describe("document hashing", () => {
  it("ignores line-ending, trailing-space and edge-blank-line differences", () => {
    const a = "TENANCY AGREEMENT\nRent: NGN 1,200,000  \n\n";
    const b = "\n\nTENANCY AGREEMENT\r\nRent: NGN 1,200,000\r\n";
    expect(canonicalizeDocument(a)).toBe(canonicalizeDocument(b));
    expect(hashDocument(a)).toBe(hashDocument(b));
  });

  it("changes when a single word changes", () => {
    expect(hashDocument("Rent: NGN 1,200,000")).not.toBe(hashDocument("Rent: NGN 1,300,000"));
  });

  it("produces a 32-byte hex hash and validates it", () => {
    const hash = hashDocument("hello");
    expect(isDocHash(hash)).toBe(true);
    expect(isDocHash("0x1234")).toBe(false);
    expect(isDocHash("not a hash")).toBe(false);
  });

  it("shortens long hashes for display", () => {
    expect(shortHash(hashDocument("hello"))).toMatch(/^0x[0-9a-f]{8}…[0-9a-f]{8}$/);
    expect(shortHash("short")).toBe("short");
  });
});
