import { describe, expect, it } from "vitest";
import { LEGAL_AID_GROUPS, LEGAL_AID_VERIFIED_ON, legalAidFor, legalAidNote } from "./legal-aid";
import { demandPersonIssue, buildExitResponseLetter } from "./letters";
import { stateMismatchWarning, statesMentioned } from "./jurisdiction";
import { hashProblem, isDocHash } from "@/lib/hash/document";

describe("R-3: legal aid carries official links, and only sourced phone numbers", () => {
  const official: Record<string, string> = {
    "Legal Aid Council of Nigeria": "legalaidcouncil.gov.ng",
    "FIDA Nigeria (International Federation of Women Lawyers)": "fida.org.ng",
    "Lagos State Office of the Public Defender": "lagosstatemoj.org",
  };
  it("names the three required bodies, each with an https link on its own official domain", () => {
    expect(LEGAL_AID_GROUPS.map((g) => g.name).sort()).toEqual(Object.keys(official).sort());
    for (const group of LEGAL_AID_GROUPS) {
      expect(new URL(group.url).protocol).toBe("https:");
      expect(new URL(group.url).hostname.endsWith(official[group.name]), group.name).toBe(true);
      if (group.contactUrl) expect(new URL(group.contactUrl).hostname.endsWith(official[group.name])).toBe(true);
    }
  });
  it("every phone number names the official page that prints it and says what that page calls it", () => {
    for (const group of LEGAL_AID_GROUPS) {
      for (const phone of group.phones) {
        expect(phone.number).toMatch(/^[+0][\d ]{9,}$/);
        expect(phone.label.length).toBeGreaterThan(3);
        expect(new URL(phone.source).hostname.endsWith(official[group.name])).toBe(true);
      }
    }
    expect(LEGAL_AID_VERIFIED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("the Lagos Public Defender is offered for Lagos only, and letters still carry no numbers", () => {
    expect(legalAidFor("Lagos").map((g) => g.name)).toContain("Lagos State Office of the Public Defender");
    expect(legalAidFor("Enugu").map((g) => g.name)).not.toContain("Lagos State Office of the Public Defender");
    expect(legalAidNote("Lagos")).not.toMatch(/\d{7,}/);
  });
});

describe("R-4: the exit reply stays in one grammatical person", () => {
  it("flags third-person wording about the landlord", () => {
    for (const bad of ["said he will change the lock", "she told me to leave", "the landlord wants me out", "told me his agent will come", "they locked the gate"]) {
      expect(demandPersonIssue(bad), bad).toMatch(/as "you"/);
    }
  });
  it("accepts wording that addresses the landlord as you", () => {
    expect(demandPersonIssue("told me to pack out within two weeks and said you will change the lock")).toBeNull();
    expect(demandPersonIssue("sent me a message asking me to leave")).toBeNull();
  });
  it("a good statement reads as one voice in the finished letter", () => {
    const { letter } = buildExitResponseLetter({
      state: "Lagos", tenantName: "Ada", landlordName: "Chief Bello", propertyAddress: "12 Akin", startDate: "2026-12-01", durationMonths: 12,
      tenancyType: "yearly", advanceMonths: 12, annualRentNgn: 1_200_000, agreementHash: "0xabc", fullySigned: true, recordLocation: "demo",
      demandDate: "2026-12-20", demandSummary: "told me to pack out and said you will change the lock", letterDate: "2026-12-21",
    });
    expect(letter).toContain("On 2026-12-20 you told me to pack out and said you will change the lock.");
  });
});

describe("R-5: the widow notice warns when the address names another state", () => {
  it("finds every state named, so 'Delta Street, Lagos' is not mistaken for Delta State", () => {
    expect(statesMentioned("12 Delta Street, Surulere, Lagos").sort()).toEqual(["Delta", "Lagos"]);
    expect(statesMentioned("a house in Abuja")).toEqual(["FCT"]);
    expect(statesMentioned("Nigeria")).toEqual([]);
  });
  it("warns on a mismatch and names both states", () => {
    const warning = stateMismatchWarning("Family house in Enugu", "Lagos");
    expect(warning).toMatch(/Enugu State/);
    expect(warning).toMatch(/Lagos State/);
  });
  it("is silent when the chosen state is named, or when the address names no state", () => {
    expect(stateMismatchWarning("4 Bode Street, Surulere, Lagos", "Lagos")).toBeNull();
    expect(stateMismatchWarning("12 Delta Street, Lagos", "Lagos")).toBeNull();
    expect(stateMismatchWarning("the family compound", "Lagos")).toBeNull();
    expect(stateMismatchWarning("", "Enugu")).toBeNull();
  });
});

describe("R-6: a typed fingerprint is checked before any lookup", () => {
  const good = `0x${"ab12".repeat(16)}`;
  it("accepts 0x plus 64 hex characters, in either case, and ignores an empty field", () => {
    expect(hashProblem(good)).toBeNull();
    expect(hashProblem(`0x${"AB12".repeat(16)}`)).toBeNull();
    expect(hashProblem("")).toBeNull();
    expect(isDocHash(good)).toBe(true);
  });
  it("says what is wrong, specifically", () => {
    expect(hashProblem("ab12")).toMatch(/starts with 0x/);
    expect(hashProblem("0X" + "a".repeat(64))).toMatch(/small 0x/);
    expect(hashProblem("0x" + "a".repeat(63))).toMatch(/has 63/);
    expect(hashProblem("0x" + "a".repeat(65))).toMatch(/has 65/);
    expect(hashProblem("0x" + "g".repeat(64))).toMatch(/only the digits/);
    expect(hashProblem(`0x${"a".repeat(63)} `)).toMatch(/has 63/); // surrounding space is ignored, the length is not
  });
});
