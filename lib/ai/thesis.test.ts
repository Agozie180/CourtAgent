import { describe, expect, it } from "vitest";
import { sanitizeAiFlags } from "./tasks";
import { runCheck } from "@/lib/domain/risk";
import { buildAgreement, type TenancyTerms } from "@/lib/domain/agreement";
import { hashDocument } from "@/lib/hash/document";

// Thesis: the AI explains and flags; it never writes or changes the legal terms.
const terms: TenancyTerms = {
  state: "Lagos",
  landlordName: "Chief Adewale Bello",
  tenantName: "Ada Okeke",
  landlordWallet: "0x000000000000000000000000000000000001a2d1",
  tenantWallet: "0x0000000000000000000000000000000000007e01",
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

describe("thesis enforced in code", () => {
  it("agreement text is a pure function of the terms (no AI input)", () => {
    expect(buildAgreement(terms)).toBe(buildAgreement({ ...terms }));
    expect(buildAgreement(terms).length).toBeGreaterThan(500);
  });

  it("AI flags can never be high, even when the model claims so", () => {
    const flags = sanitizeAiFlags({
      flags: [
        { severity: "high", message: "This is definitely a scam, run away" },
        { severity: "critical", message: "Another loud claim from the model" },
      ],
    });
    expect(flags.length).toBe(2);
    expect(flags.every((f) => f.severity !== "high" && f.source === "ai")).toBe(true);
  });

  it("AI flags alone cannot move a clean check to High risk", () => {
    const ai = sanitizeAiFlags({ flags: Array.from({ length: 10 }, () => ({ severity: "high", message: "Looks suspicious to me" })) });
    const result = runCheck(
      {
        state: "Lagos",
        claimedLandlordName: "Chief Adewale Bello",
        documentText: "Receipt issued by Chief Adewale Bello for the flat at Lekki.",
        advanceMonths: 12,
        answers: {
          inspectedInPerson: true, sawOriginalTitle: true, dealingWithAgent: false, agentHasAuthorityLetter: false,
          askedToPayBeforeViewing: false, paymentToPersonalAccount: false, receiptPromised: true,
        },
      },
      ai,
    );
    expect(result.level).not.toBe("high");
  });

  it("a one-word change gives a different hash", () => {
    const text = buildAgreement(terms);
    expect(hashDocument(text)).not.toBe(hashDocument(text.replace("1,200,000", "1,300,000")));
  });
});
