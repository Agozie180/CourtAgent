import { describe, expect, it } from "vitest";
import { emptyIntake, nameProblem, overBudgetWarning, parseIntakeOffline, restrictToExpected } from "./intake";
import { plural } from "./text";
import { exitLetterDateIssues, buildWidowLetter } from "./letters";
import { mentionsWill, validatePropertyRecord, buildPropertyRecord } from "./property";
import { legalAidFor, legalAidNote } from "./legal-aid";
import { validateTerms } from "./agreement";
import { aiStatus, availableProviders, complete, misnamedKeyVariables } from "@/lib/ai/provider";
import { runIntake } from "@/lib/ai/tasks";

describe("plural", () => {
  it("says 1 month and 12 months", () => {
    expect(plural(1, "month")).toBe("1 month");
    expect(plural(0, "month")).toBe("0 months");
    expect(plural(12, "month")).toBe("12 months");
    expect(plural(2, "warning sign")).toBe("2 warning signs");
  });
});

describe("chat answers must fit the question", () => {
  it("does not accept a sentence about a house as a landlord's name", () => {
    expect(nameProblem("I want a house in Abuja for 5k")).not.toBeNull();
    expect(nameProblem("2 bedroom flat")).not.toBeNull();
    expect(nameProblem("Mr Chinedu Eze")).toBeNull();
    expect(nameProblem("Ngozi Okoro-Eze")).toBeNull();
    expect(nameProblem("Mrs O'Brien")).toBeNull();
    expect(parseIntakeOffline("I want a house in Abuja for 5k", "landlordName")).toEqual({});
  });
  it("never changes the state unless the state question is being answered", () => {
    expect(parseIntakeOffline("a flat in Abuja", "bedrooms").state).toBeUndefined();
    expect(parseIntakeOffline("Chinedu Eze of Enugu", "landlordName").state).toBeUndefined();
    expect(parseIntakeOffline("Enugu", "state").state).toBe("Enugu");
  });
  it("lets only the asked field change once the early questions are done", () => {
    const current = { ...emptyIntake(), state: "Lagos", budgetNgn: 1_000_000, bedrooms: 2, parlour: true, area: "Yaba" };
    const update = restrictToExpected({ state: "FCT", bedrooms: 5, annualRentNgn: 5000, landlordName: "Mr Eze" }, current, "landlordName");
    expect(update).toEqual({ landlordName: "Mr Eze" });
  });
  it("runIntake keeps the state, asks the same question again and says why", async () => {
    const current = { ...emptyIntake(), state: "Lagos", budgetNgn: 1_000_000, bedrooms: 2, parlour: true, area: "Yaba" };
    const result = await runIntake("I want a house in Abuja for 5k", current, "landlordName", {});
    expect(result.fields.state).toBe("Lagos");
    expect(result.fields.landlordName).toBeNull();
    expect(result.accepted).toBe(false);
    expect(result.reply).toMatch(/does not look like a person's full name/i);
    expect(result.reply).toMatch(/landlord's full name/i);
  });
});

describe("budget warning", () => {
  it("warns only when the quote is above the budget", () => {
    expect(overBudgetWarning({ annualRentNgn: 1_800_000, budgetNgn: 1_000_000 })).toMatch(/NGN 800,000 above your budget/);
    expect(overBudgetWarning({ annualRentNgn: 900_000, budgetNgn: 1_000_000 })).toBeNull();
    expect(overBudgetWarning({ annualRentNgn: 900_000, budgetNgn: null })).toBeNull();
  });
});

describe("letter dates", () => {
  it("rejects a demand dated before the tenancy started, and a letter dated before the demand", () => {
    expect(exitLetterDateIssues({ startDate: "2026-12-01", demandDate: "2026-11-30", letterDate: "2026-12-05" })).toHaveLength(1);
    expect(exitLetterDateIssues({ startDate: "2026-12-01", demandDate: "2026-12-10", letterDate: "2026-12-09" })).toHaveLength(1);
    expect(exitLetterDateIssues({ startDate: "2026-12-01", demandDate: "2026-12-10", letterDate: "2026-12-10" })).toEqual([]);
  });
});

describe("widow record: will", () => {
  const base = { registrantName: "A", registrantWallet: "0x" + "1".repeat(40), propertyDescription: "House", documentsHeld: "Deed, last will and testament", whereKept: "Home", hasWill: false, willSummary: "", recordDate: "2026-10-17" };
  it("blocks a record that lists a will but says no will was made", () => {
    expect(mentionsWill("Deed, Last Will and Testament")).toBe(true);
    expect(mentionsWill("Deed of assignment, survey plan")).toBe(false);
    expect(validatePropertyRecord(base).join(" ")).toMatch(/listed a will/);
    expect(validatePropertyRecord({ ...base, hasWill: true })).toEqual([]);
  });
  it("names a second signer in the text when one is chosen, and validates the wallet", () => {
    const witness = "0x" + "2".repeat(40);
    expect(buildPropertyRecord({ ...base, hasWill: true, witnessWallet: witness })).toContain(`Witness, who must also sign: wallet ${witness}`);
    expect(buildPropertyRecord({ ...base, hasWill: true })).not.toContain("Witness");
    expect(validatePropertyRecord({ ...base, hasWill: true, witnessWallet: "" }).join(" ")).toMatch(/witness wallet/i);
    expect(validatePropertyRecord({ ...base, hasWill: true, witnessWallet: base.registrantWallet }).join(" ")).toMatch(/different wallet/i);
  });
});

describe("legal content", () => {
  const input = { widowName: "Mrs A", deceasedName: "B", propertyDescription: "House", recordHash: "0xdef", recordLocation: "sepolia" as const, registeredOn: "2026-10-20", hasWill: false, addressedTo: "The family", letterDate: "2026-11-01", marriageType: "customary" as const };
  it("describes Ukeje v Ukeje as a daughter-inheritance case and never as a widow's right to stay", () => {
    const withDaughters = buildWidowLetter({ ...input, state: "Lagos", hasDaughters: true }).letter;
    expect(withDaughters).toMatch(/Ukeje v Ukeje \(2014\)[^.]*daughter[^.]*inheriting/);
    expect(withDaughters).toMatch(/does not by itself decide who may live in the property/);
    expect(withDaughters).not.toMatch(/Supreme Court[^.]*widow[^.]*entitled to remain/i);
    expect(buildWidowLetter({ ...input, state: "Lagos", hasDaughters: false }).letter).not.toContain("Ukeje");
  });
  it("lists only legal aid that fits the state and never a phone number", () => {
    expect(legalAidFor("Lagos").map((g) => g.name)).toContain("Lagos State Office of the Public Defender");
    expect(legalAidFor("Enugu").map((g) => g.name)).not.toContain("Lagos State Office of the Public Defender");
    expect(legalAidNote("Enugu")).toMatch(/Ministry of Justice of Enugu State/);
    expect(legalAidNote("Enugu")).not.toMatch(/Lagos State Office/);
    expect(legalAidNote("Lagos")).toMatch(/Lagos State Office of the Public Defender/);
    for (const state of ["Lagos", "Enugu", "FCT"]) expect(legalAidNote(state)).not.toMatch(/\d{7,}/);
  });
});

describe("signers", () => {
  it("rejects a witness who is also the landlord or the tenant, and an empty witness when one is required", () => {
    const base = { state: "Lagos", landlordName: "A", tenantName: "B", propertyAddress: "1 Road", annualRentNgn: 1_000_000, cautionNgn: 0, bedrooms: 2, parlour: true, startDate: "2026-11-01", durationMonths: 12, tenancyType: "yearly" as const, advanceMonths: 12, landlordWallet: "0x" + "1".repeat(40), tenantWallet: "0x" + "2".repeat(40) };
    expect(validateTerms({ ...base, witnessWallet: "0x" + "3".repeat(40) })).toEqual([]);
    expect(validateTerms({ ...base, witnessWallet: "0x" + "1".repeat(40) }).map((i) => i.field)).toContain("witnessWallet");
    expect(validateTerms({ ...base, witnessWallet: "" }).map((i) => i.field)).toContain("witnessWallet");
  });
});

describe("AI mode is detected from the server's variables", () => {
  it("turns on when a key exists, including one pasted with quotes or spaces", async () => {
    expect(aiStatus({}).provider).toBe("offline");
    expect(aiStatus({}).reason).toBe("no-key");
    expect(aiStatus({ ANTHROPIC_API_KEY: "sk-ant-x" }).provider).toBe("anthropic");
    expect(aiStatus({ ANTHROPIC_API_KEY: '  "sk-ant-x"  ' }).provider).toBe("anthropic");
    expect(availableProviders({ OPENAI_API_KEY: "sk-x" })).toEqual(["openai"]);
    expect(aiStatus({ ANTHROPIC_API_KEY: "sk-ant-x", AI_PROVIDER: "offline" }).reason).toBe("disabled");
  });
  it("points out a key stored under a name that is not read, without revealing it", () => {
    const env = { NEXT_PUBLIC_ANTHROPIC_API_KEY: "sk-secret", CLAUDE_API_KEY: "sk-secret2", ANTHROPIC_API_KEY: "" };
    expect(misnamedKeyVariables(env)).toEqual(["CLAUDE_API_KEY", "NEXT_PUBLIC_ANTHROPIC_API_KEY"]);
    const status = aiStatus(env);
    expect(status.provider).toBe("offline");
    expect(JSON.stringify(status)).not.toContain("sk-secret");
  });
  it("reports a failing AI request instead of silently saying there is no key", async () => {
    const errors: string[] = [];
    const fail = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    const result = await complete({ system: "s", user: "u" }, { ANTHROPIC_API_KEY: "k" }, fail, errors);
    expect(result).toBeNull();
    expect(errors[0]).toMatch(/status 404/);
    const intake = await runIntake("Lagos", emptyIntake(), "state", { ANTHROPIC_API_KEY: "k" }, fail);
    expect(intake.provider).toBe("offline");
    expect(intake.aiError).toMatch(/status 404/);
    expect(intake.fields.state).toBe("Lagos");
  });
});
