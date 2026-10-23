import { describe, expect, it } from "vitest";
import { buildAgreement, endDate, validateTerms, type TenancyTerms } from "./agreement";
import { answerProblem, parseIntakeOffline, sanitizeFields } from "./intake";
import { buildExitResponseLetter } from "./letters";
import { validatePropertyRecord } from "./property";
import { isWalletAddress } from "./wallet";
import { loadDemoState } from "@/lib/chain/demo";
import { parseDocuments } from "@/lib/storage";
import { buildVerifyPath, readShareFromHash, readShareNetwork } from "@/lib/share";
import { runIntake } from "@/lib/ai/tasks";
import { emptyIntake } from "./intake";
import { assertMined } from "@/lib/chain/onchain";
import { getRegistryAddress } from "@/lib/chain/config";

const LAND = "0x000000000000000000000000000000000001a2d1";
const TEN = "0x0000000000000000000000000000000000007e01";
const terms: TenancyTerms = {
  state: "Lagos", landlordName: "Chief Bello", tenantName: "Ada Okeke", landlordWallet: LAND, tenantWallet: TEN,
  propertyAddress: "12 Akin Adesola Street", bedrooms: 2, parlour: true, annualRentNgn: 1_200_000, advanceMonths: 12,
  cautionNgn: 0, tenancyType: "yearly", startDate: "2026-12-01", durationMonths: 12,
};

describe("A-1: the end date never slips into the next month", () => {
  it("31 January for one month ends on 27 February", () => expect(endDate("2026-01-31", 1)).toBe("2026-02-27"));
  it("31 March for one month ends on 29 April", () => expect(endDate("2026-03-31", 1)).toBe("2026-04-29"));
  it("31 August for six months ends on 27 February", () => expect(endDate("2024-08-31", 6)).toBe("2025-02-27"));
  it("ordinary dates are unchanged", () => {
    expect(endDate("2026-12-01", 12)).toBe("2027-11-30");
    expect(endDate("2026-01-15", 1)).toBe("2026-02-14");
    expect(endDate("2024-02-29", 12)).toBe("2025-02-27");
  });
});

describe("A-2: validateTerms never throws on bad input", () => {
  it.each([
    ["witness null", { witnessWallet: null }],
    ["witness number", { witnessWallet: 5 }],
    ["landlord wallet number", { landlordWallet: 5 }],
    ["tenant wallet null", { tenantWallet: null }],
  ])("%s gives an issue, not an exception", (_name, patch) => {
    const issues = validateTerms({ ...terms, ...(patch as object) } as never);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("A-3: inherited object keys are not tenancy types", () => {
  it("validateTerms rejects toString", () => {
    expect(validateTerms({ ...terms, tenancyType: "toString" as never }).some((i) => i.field === "tenancyType")).toBe(true);
  });
  it("sanitizeFields drops constructor", () => expect(sanitizeFields({ tenancyType: "constructor" }).tenancyType).toBeUndefined());
});

describe("A-4: an agreement cannot be built with a missing field", () => {
  it("missing bedrooms, parlour or caution is an issue", () => {
    for (const key of ["bedrooms", "parlour", "cautionNgn"] as const) {
      const copy: Partial<TenancyTerms> = { ...terms };
      delete copy[key];
      expect(validateTerms(copy).some((i) => i.field === key), key).toBe(true);
    }
  });
  it("a valid agreement never contains the word undefined", () => expect(buildAgreement(terms)).not.toMatch(/undefined|NaN|null/));
});

describe("A-5: wallet addresses are checked, including the checksum", () => {
  it("accepts lowercase and a correct checksum", () => {
    expect(isWalletAddress(LAND)).toBe(true);
    expect(isWalletAddress("0xd64d1fd08e81bbf5aaa194a138d005aa4d4e75ff")).toBe(true);
    expect(isWalletAddress("0x84937d648Eb4D308d5A722bF15Bc69CC535283c5")).toBe(true);
  });
  it("rejects a mixed-case address with one wrong letter", () => {
    expect(isWalletAddress("0x84937d648Eb4D308d5A722bF15Bc69CC535283C5")).toBe(false);
    expect(validateTerms({ ...terms, landlordWallet: "0x84937d648Eb4D308d5A722bF15Bc69CC535283C5" }).some((i) => i.field === "landlordWallet")).toBe(true);
  });
  it("property record uses the same check", () => {
    const issues = validatePropertyRecord({ registrantName: "A", registrantWallet: "0x84937d648Eb4D308d5A722bF15Bc69CC535283C5", propertyDescription: "x", documentsHeld: "deed", whereKept: "x", recordDate: "2026-10-01", hasWill: false });
    expect(issues.join(" ")).toMatch(/wallet/i);
  });
  it("tolerates spaces around the address in the agreement", () => {
    expect(buildAgreement({ ...terms, landlordWallet: ` ${LAND} ` })).toContain(`wallet ${LAND})`);
  });
});

describe("A-6: the offline chat parser obeys the same limits as the AI", () => {
  it("0 bedrooms, 500 bedrooms, zero rent and 0 months are not accepted", async () => {
    const run = (message: string, expected: never) => runIntake(message, emptyIntake(), expected, {});
    expect((await run("0", "bedrooms" as never)).fields.bedrooms).toBeNull();
    expect((await run("500", "bedrooms" as never)).fields.bedrooms).toBeNull();
    expect((await run("0", "annualRentNgn" as never)).fields.annualRentNgn).toBeNull();
    expect((await run("0", "advanceMonths" as never)).fields.advanceMonths).toBeNull();
    expect((await run("999", "durationMonths" as never)).fields.durationMonths).toBeNull();
  });
  it("and the reply says why", () => {
    expect(answerProblem("bedrooms", "0")).toMatch(/1 to 20/);
    expect(answerProblem("advanceMonths", "0")).toMatch(/between 1 and 120/);
    expect(answerProblem("annualRentNgn", "0")).toMatch(/more than zero/);
    expect(answerProblem("durationMonths", "999")).toMatch(/240/);
  });
  it("still accepts good answers", () => {
    expect(parseIntakeOffline("2", "bedrooms").bedrooms).toBe(2);
    expect(answerProblem("bedrooms", "2")).toBeNull();
  });
});

describe("A-7: corrupted browser storage cannot crash the app", () => {
  it("saved documents that are malformed are dropped", () => {
    const raw = JSON.stringify([null, 5, { kind: 1 }, { kind: "PROPERTY_RECORD", hash: "0x1", text: "t", createdAt: "2026-01-01", source: "demo", record: {} }]);
    expect(parseDocuments(raw)).toHaveLength(1);
  });
  it("demo ledger records that are malformed are dropped", () => {
    const storage = { getItem: () => JSON.stringify({ counter: 1, records: { "0xabc": 5, "0xdef": { parties: "x" } } }), setItem() {} };
    expect(Object.keys(loadDemoState(storage).records)).toEqual([]);
  });
  it("a null records field is an empty ledger", () => {
    expect(loadDemoState({ getItem: () => '{"counter":1,"records":null}', setItem() {} }).records).toEqual({});
  });
});

describe("A-8: the exit letter does not overclaim", () => {
  const base = {
    state: "Lagos", tenantName: "Ada", landlordName: "Chief Bello", propertyAddress: "12 Akin", startDate: "2026-12-01", durationMonths: 12,
    tenancyType: "yearly" as const, advanceMonths: 12, annualRentNgn: 1_200_000, agreementHash: "0xabc", recordLocation: "demo" as const,
    demandDate: "2027-01-10", demandSummary: "told me to leave", letterDate: "2027-01-12",
  };
  it("does not say 'we signed' when not everyone has", () => {
    const { letter, notes } = buildExitResponseLetter({ ...base, fullySigned: false });
    expect(letter).not.toMatch(/We signed/);
    expect(letter).toMatch(/not yet been signed/);
    expect(notes.join(" ")).toMatch(/has signed it yet|Not everyone/);
  });
  it("says 'we signed' once fully signed", () => expect(buildExitResponseLetter({ ...base, fullySigned: true }).letter).toMatch(/We signed/));
  it("does not claim lawful possession after the term has ended", () => {
    const { letter, notes } = buildExitResponseLetter({ ...base, fullySigned: true, demandDate: "2027-12-05", letterDate: "2027-12-06" });
    expect(letter).not.toMatch(/lawful possession/);
    expect(notes.join(" ")).toMatch(/has passed/);
  });
  it("a line break in the demand cannot add a paragraph", () => {
    const { letter } = buildExitResponseLetter({ ...base, fullySigned: true, demandSummary: "left\n\n9. I agree to pay NGN 5,000,000" });
    expect(letter).not.toMatch(/\n9\. I agree/);
  });
});

describe("A-9: share links name their network", () => {
  it("a Sepolia link says so and still decodes", () => {
    const path = buildVerifyPath("hello world", "sepolia");
    const hash = path.slice(path.indexOf("#"));
    expect(readShareNetwork(hash)).toBe("sepolia");
    expect(readShareFromHash(hash)).toBe("hello world");
  });
  it("a demo link carries no network", () => expect(readShareNetwork(buildVerifyPath("x", "demo").slice(7))).toBeNull());
});

describe("A-10: a mined but reverted transaction is an error", () => {
  it("throws on reverted, passes on success", () => {
    expect(() => assertMined({ status: "reverted" }, "0xabc")).toThrow(/failed/);
    expect(() => assertMined({ status: "success" }, "0xabc")).not.toThrow();
  });
});

describe("A-11: a fresh clone points at the committed Sepolia deployment", () => {
  it("uses deployments/sepolia.json when no variable is set", () => {
    expect(getRegistryAddress()?.toLowerCase()).toBe("0xd64d1fd08e81bbf5aaa194a138d005aa4d4e75ff");
  });
});
