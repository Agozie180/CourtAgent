import { describe, expect, it } from "vitest";
import {
  emptyIntake,
  isComplete,
  mergeFields,
  nextMissing,
  parseDate,
  parseIntakeOffline,
  parseMoney,
  parseMonths,
  parseTenancyType,
  sanitizeFields,
} from "./intake";
import { checkAdvanceRent, defaultNotice } from "./lagos-tenancy";
import { buildAgreement, endDate, validateTerms, type TenancyTerms } from "./agreement";
import { levelFor, nameAppearsIn, runCheck, type CheckInput } from "./risk";
import { buildExitResponseLetter, buildWidowLetter } from "./letters";

const TENANT = "0x0000000000000000000000000000000000007e01";
const LANDLORD = "0x000000000000000000000000000000000001a2d1";

const terms: TenancyTerms = {
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

describe("Lagos tenancy rules", () => {
  it("caps advance rent at 12 months for a new tenant", () => {
    expect(checkAdvanceRent(12).ok).toBe(true);
    expect(checkAdvanceRent(24).ok).toBe(false);
    expect(checkAdvanceRent(0).ok).toBe(false);
  });
  it("gives the default notice periods", () => {
    expect(defaultNotice("yearly")).toBe("6 months");
    expect(defaultNotice("monthly")).toBe("1 month");
    expect(defaultNotice("quarterly")).toBe("3 months");
    expect(defaultNotice("half_yearly")).toBe("3 months");
    expect(defaultNotice("at_will")).toBe("1 week");
  });
});

describe("intake parsing (offline)", () => {
  it("reads naira amounts in common Nigerian styles", () => {
    expect(parseMoney("1.2 million")).toBe(1_200_000);
    expect(parseMoney("₦1,500,000")).toBe(1_500_000);
    expect(parseMoney("800k")).toBe(800_000);
    expect(parseMoney("NGN 2m")).toBe(2_000_000);
    expect(parseMoney("hello")).toBeNull();
  });
  it("reads months, dates and tenancy types", () => {
    expect(parseMonths("1 year")).toBe(12);
    expect(parseMonths("two years")).toBe(24);
    expect(parseMonths("6 months")).toBe(6);
    expect(parseDate("2026-12-01")).toBe("2026-12-01");
    expect(parseDate("1 Dec 2026")).toBe("2026-12-01");
    expect(parseDate("01/12/2026")).toBe("2026-12-01");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseTenancyType("half yearly")).toBe("half_yearly");
    expect(parseTenancyType("monthly")).toBe("monthly");
    expect(parseTenancyType("fixed term")).toBe("fixed_term");
  });
  it("uses the question that was asked to read short answers", () => {
    expect(parseIntakeOffline("2", "bedrooms")).toEqual({ bedrooms: 2 });
    expect(parseIntakeOffline("yes please", "parlour")).toEqual({ parlour: true });
    expect(parseIntakeOffline("no", "parlour")).toEqual({ parlour: false });
    expect(parseIntakeOffline("Yaba", "area")).toEqual({ area: "Yaba" });
    expect(parseIntakeOffline("my name is Ada Okeke", "tenantName")).toEqual({ tenantName: "Ada Okeke" });
    expect(parseIntakeOffline("none", "cautionNgn")).toEqual({ cautionNgn: 0 });
  });
  it("also picks up extra details given in one message", () => {
    const found = parseIntakeOffline("I want a 2 bedroom with parlour in Lekki", "budgetNgn");
    expect(found.bedrooms).toBe(2);
    expect(found.parlour).toBe(true);
    expect(found.area).toBe("Lekki");
  });
  it("walks the fields in order until complete", () => {
    let fields = emptyIntake();
    expect(nextMissing(fields)).toBe("budgetNgn");
    fields = mergeFields(fields, { budgetNgn: 1_200_000, bedrooms: 2 });
    expect(nextMissing(fields)).toBe("parlour");
    expect(isComplete(fields)).toBe(false);
  });
  it("sanitizes untrusted (AI) output", () => {
    const clean = sanitizeFields({
      budgetNgn: 1_000_000,
      bedrooms: "two",
      parlour: "yes",
      tenancyType: "forever",
      startDate: "2026-02-31",
      advanceMonths: 12,
      area: "A",
    });
    expect(clean).toEqual({ budgetNgn: 1_000_000, advanceMonths: 12 });
  });
});

describe("agreement builder", () => {
  it("computes the end date as the day before the anniversary", () => {
    expect(endDate("2026-12-01", 12)).toBe("2027-11-30");
  });
  it("accepts good terms and flags bad ones", () => {
    expect(validateTerms(terms)).toEqual([]);
    const bad = validateTerms({ ...terms, advanceMonths: 24, tenantWallet: LANDLORD });
    expect(bad.map((issue) => issue.field).sort()).toEqual(["advanceMonths", "tenantWallet"]);
  });
  it("writes the key terms into the text and is deterministic", () => {
    const text = buildAgreement(terms);
    expect(text).toContain("Chief Adewale Bello");
    expect(text).toContain("NGN 1,200,000");
    expect(text).toContain("6 months");
    expect(text).toContain("ending on 2027-11-30");
    expect(text).toContain("will not remove the tenant");
    expect(buildAgreement(terms)).toBe(text);
  });
  it("uses the agreed notice when the parties set one", () => {
    expect(buildAgreement({ ...terms, agreedNotice: "3 months" })).toContain("at least 3 months");
  });
});

describe("scam risk check", () => {
  const safe: CheckInput = {
    claimedLandlordName: "Chief Adewale Bello",
    documentText: "Receipt issued by Chief Adewale Bello for the flat at Lekki.",
    advanceMonths: 12,
    answers: {
      inspectedInPerson: true,
      sawOriginalTitle: true,
      dealingWithAgent: false,
      agentHasAuthorityLetter: false,
      askedToPayBeforeViewing: false,
      paymentToPersonalAccount: false,
      receiptPromised: true,
    },
  };

  it("rates a clean case Low", () => {
    const result = runCheck(safe);
    expect(result.level).toBe("Low");
    expect(result.flags).toEqual([]);
  });
  it("rates a classic scam pattern High", () => {
    const result = runCheck({
      ...safe,
      claimedLandlordName: "Chief Adewale Bello",
      documentText: "I am abroad. Pay today, many people are interested. Send gift card.",
      advanceMonths: 24,
      answers: { ...safe.answers, inspectedInPerson: false, askedToPayBeforeViewing: true },
    });
    expect(result.level).toBe("High");
    const ids = result.flags.map((flag) => flag.id);
    expect(ids).toEqual(expect.arrayContaining(["ADVANCE_OVER_LIMIT", "NOT_INSPECTED", "NAME_MISMATCH", "TEXT_ABROAD"]));
  });
  it("flags an agent without authority", () => {
    const result = runCheck({ ...safe, answers: { ...safe.answers, dealingWithAgent: true } });
    expect(result.flags.map((flag) => flag.id)).toContain("AGENT_NO_AUTHORITY");
    expect(result.level).toBe("Medium");
  });
  it("matches names loosely but not wrongly", () => {
    expect(nameAppearsIn("Mr. Adewale Bello", "Owner: BELLO, Adewale")).toBe(true);
    expect(nameAppearsIn("Adewale Bello", "Owner: Tunde Bello")).toBe(false);
  });
  it("maps scores to levels", () => {
    expect(levelFor(0)).toBe("Low");
    expect(levelFor(2)).toBe("Medium");
    expect(levelFor(5)).toBe("High");
  });
});

describe("letters", () => {
  it("builds the exit-demand reply from the signed terms", () => {
    const { letter, notes } = buildExitResponseLetter({
      tenantName: terms.tenantName,
      landlordName: terms.landlordName,
      propertyAddress: terms.propertyAddress,
      startDate: terms.startDate,
      durationMonths: terms.durationMonths,
      tenancyType: terms.tenancyType,
      advanceMonths: terms.advanceMonths,
      annualRentNgn: terms.annualRentNgn,
      agreementHash: "0xabc",
      fullySigned: true,
      demandDate: "2027-01-10",
      demandSummary: "told me to pack out within two weeks.",
      letterDate: "2027-01-11",
    });
    expect(letter).toContain("notice to end the tenancy is 6 months");
    expect(letter).toContain("cannot evict a tenant personally");
    expect(letter).toContain("told me to pack out within two weeks. I did not agree");
    expect(letter).toContain("0xabc");
    expect(notes.length).toBeGreaterThan(3);
  });
  it("builds the widow notice with the right legal lines", () => {
    const base = {
      widowName: "Mrs Ngozi Okoro",
      deceasedName: "Emeka Okoro",
      propertyDescription: "the family house at 4 Bode Street, Surulere, Lagos",
      recordHash: "0xdef",
      recordDate: "2026-10-20",
      hasWill: false,
      addressedTo: "The family of the late Mr Emeka Okoro",
      letterDate: "2026-11-01",
    };
    const statutory = buildWidowLetter({ ...base, marriageType: "statutory", hasDaughters: true });
    expect(statutory.letter).toContain("Administration of Estates Law of Lagos State, 2015");
    expect(statutory.letter).toContain("Ukeje v Ukeje (2014)");
    expect(statutory.letter).toContain("not a court order");
    const customary = buildWidowLetter({ ...base, marriageType: "customary", hasDaughters: false });
    expect(customary.letter).not.toContain("Ukeje");
    expect(customary.letter).not.toContain("Administration of Estates Law");
    expect(customary.letter).toContain("customary marriage");
  });
});
