import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import deployment from "../../deployments/sepolia.json";
import samples from "../../deployments/sepolia-samples.json";

describe("Sepolia sample records (owner-supplied)", () => {
  it("point at the committed contract and are well formed", () => {
    expect(getAddress(samples.contract)).toBe(getAddress(deployment.address));
    expect(samples.chainId).toBe(11155111);
    const seen = new Set<string>();
    for (const record of samples.records) {
      expect(record.fingerprint).toMatch(/^0x[0-9a-f]{64}$/);
      expect(record.transactions.length).toBeGreaterThan(0);
      for (const tx of record.transactions) {
        expect(tx.hash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(tx.block).toBeGreaterThan(deployment.block);
        expect(seen.has(tx.hash)).toBe(false);
        seen.add(tx.hash);
        expect(record.parties.map((a) => getAddress(a))).toContain(getAddress(tx.from));
      }
      const blocks = record.transactions.map((tx) => tx.block);
      expect([...blocks].sort((a, b) => a - b)).toEqual(blocks);
    }
  });
});
