import { describe, expect, it } from "vitest";
import { CORPUS, HELD_OUT, NEUTRAL_ANSWERS, type CorpusItem } from "./corpus";
import { runCheck, type RiskLevel } from "./risk";

const levelOf = (text: string): RiskLevel =>
  runCheck({ state: "Lagos", claimedLandlordName: "", documentText: text, advanceMonths: 12, answers: NEUTRAL_ANSWERS }).level;
const byLabel = (items: CorpusItem[], label: CorpusItem["label"]) => items.filter((item) => item.label === label);

// These numbers are quoted in README.md and AUDIT.md. If you change a rule, run `npm run measure`,
// then update the numbers here AND in those two files, so the documents never claim more than the code does.
describe("scam-message corpus (regression suite, in-sample)", () => {
  it("flags every sample scam message at Medium or High", () => {
    const missed = byLabel(CORPUS, "scam").filter((item) => levelOf(item.text) === "Low").map((item) => item.id);
    expect(missed).toEqual([]);
  });

  it("does not flag any sample honest message (F-3: 'I am travelling' is not a scam signal)", () => {
    const flagged = byLabel(CORPUS, "legit").filter((item) => levelOf(item.text) !== "Low").map((item) => item.id);
    expect(flagged).toEqual([]);
  });

  it("no honest message is ever rated High by the text rules", () => {
    const high = [...byLabel(CORPUS, "legit"), ...byLabel(HELD_OUT, "legit")].filter((item) => levelOf(item.text) === "High");
    expect(high).toEqual([]);
  });
});

describe("held-out set (written after the rules were frozen): the honest numbers", () => {
  it("text rules alone catch only 3 of 10 unseen scam wordings", () => {
    const caught = byLabel(HELD_OUT, "scam").filter((item) => levelOf(item.text) !== "Low").map((item) => item.id);
    expect(caught).toEqual(["H05", "H09", "H10"]);
  });

  it("text rules wrongly flag 2 of 8 unseen honest messages (known limits, see AUDIT.md)", () => {
    const flagged = byLabel(HELD_OUT, "legit").filter((item) => levelOf(item.text) !== "Low").map((item) => item.id);
    expect(flagged).toEqual(["HL04", "HL08"]);
  });
});
