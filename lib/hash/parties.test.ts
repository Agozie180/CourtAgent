import { describe, expect, it } from "vitest";
import { keccak256, toBytes } from "viem";
import { addressesInText, comparePartiesToText } from "./parties";
import { buildAgreement, type TenancyTerms } from "@/lib/domain/agreement";

const TENANT = "0x0000000000000000000000000000000000007e01";
const LANDLORD = "0x000000000000000000000000000000000001a2d1";
const STRANGER = "0x0000000000000000000000000000000000000abc";

const terms: TenancyTerms = {
  state: "Lagos",
  landlordName: "Chief Adewale Bello",
  tenantName: "Ada Okeke",
  landlordWallet: LANDLORD,
  tenantWallet: TENANT,
  propertyAddress: "Flat 3, 12 Akin Adesola Street, Lekki",
  bedrooms: 2,
  parlour: true,
  annualRentNgn: 1_200_000,
  advanceMonths: 12,
  cautionNgn: 100_000,
  tenancyType: "yearly",
  startDate: "2026-12-01",
  durationMonths: 12,
};

describe("party cross-check (finding F-2)", () => {
  it("finds the wallets written in a real agreement", () => {
    expect(addressesInText(buildAgreement(terms)).length).toBe(2);
  });

  it("does not mistake a 66-character hash for an address", () => {
    const hash = keccak256(toBytes("x"));
    expect(addressesInText(`fingerprint ${hash}`)).toEqual([]);
  });

  it("matches when the registry parties are exactly the wallets in the text", () => {
    expect(comparePartiesToText(buildAgreement(terms), [TENANT, LANDLORD]).status).toBe("match");
    expect(comparePartiesToText(buildAgreement(terms), [LANDLORD, TENANT]).status).toBe("match");
  });

  it("flags a squatter who registered the same text under different parties", () => {
    const check = comparePartiesToText(buildAgreement(terms), [STRANGER]);
    expect(check.status).toBe("mismatch");
    expect(check.textOnly.length).toBe(2);
    expect(check.onChainOnly.length).toBe(1);
  });

  it("flags a record that is missing one of the named parties", () => {
    expect(comparePartiesToText(buildAgreement(terms), [TENANT]).status).toBe("mismatch");
  });

  it("says nothing when the text names no wallet", () => {
    expect(comparePartiesToText("A note with no wallet in it.", [TENANT]).status).toBe("none");
  });
});
