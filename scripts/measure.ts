/**
 * Prints the numbers quoted in the README, so every number has a command that reproduces it:  npm run measure
 * (Gas numbers come from `npm run contracts:test`; test counts from `npm test`.)
 */
import { CORPUS, HELD_OUT, NEUTRAL_ANSWERS } from "../lib/domain/corpus";
import { runCheck } from "../lib/domain/risk";
import { buildAgreement, type TenancyTerms } from "../lib/domain/agreement";
import { hashDocument } from "../lib/hash/document";

const levelOf = (text: string) =>
  runCheck({ state: "Lagos", claimedLandlordName: "", documentText: text, advanceMonths: 12, answers: NEUTRAL_ANSWERS }).level;

const scams = CORPUS.filter((item) => item.label === "scam");
const legit = CORPUS.filter((item) => item.label === "legit");
const flagged = scams.filter((item) => levelOf(item.text) !== "Low");
const high = scams.filter((item) => levelOf(item.text) === "High");
const falsePositives = legit.filter((item) => levelOf(item.text) !== "Low");
const falseHigh = legit.filter((item) => levelOf(item.text) === "High");

console.log("Scam-message corpus (text patterns only, all questionnaire answers neutral)");
console.log(`  scam messages flagged Medium or High : ${flagged.length}/${scams.length}`);
console.log(`  scam messages rated High             : ${high.length}/${scams.length}`);
console.log(`  honest messages flagged Medium/High  : ${falsePositives.length}/${legit.length}  ${falsePositives.map((i) => i.id).join(" ")}`);
console.log(`  honest messages rated High           : ${falseHigh.length}/${legit.length}`);
const missed = scams.filter((item) => levelOf(item.text) === "Low").map((item) => item.id);
if (missed.length) console.log(`  missed scams                         : ${missed.join(" ")}`);

const hScams = HELD_OUT.filter((item) => item.label === "scam");
const hLegit = HELD_OUT.filter((item) => item.label === "legit");
const hFlagged = hScams.filter((item) => levelOf(item.text) !== "Low");
const hFalse = hLegit.filter((item) => levelOf(item.text) !== "Low");
console.log("\nHeld-out set (written after the rules were frozen; not used to tune anything)");
console.log(`  scam messages flagged Medium or High : ${hFlagged.length}/${hScams.length}  missed: ${hScams.filter((i) => levelOf(i.text) === "Low").map((i) => i.id).join(" ")}`);
console.log(`  scam messages rated High             : ${hScams.filter((i) => levelOf(i.text) === "High").length}/${hScams.length}`);
console.log(`  honest messages flagged Medium/High  : ${hFalse.length}/${hLegit.length}  ${hFalse.map((i) => i.id).join(" ")}`);
console.log(`  honest messages rated High           : ${hLegit.filter((i) => levelOf(i.text) === "High").length}/${hLegit.length}`);

const terms: TenancyTerms = {
  state: "Lagos", landlordName: "Chief Adewale Bello", tenantName: "Ada Okeke",
  landlordWallet: "0x000000000000000000000000000000000001a2d1", tenantWallet: "0x0000000000000000000000000000000000007e01",
  propertyAddress: "Flat 3, 12 Akin Adesola Street, Lekki", bedrooms: 2, parlour: true, annualRentNgn: 1_200_000,
  advanceMonths: 12, cautionNgn: 100_000, tenancyType: "yearly", startDate: "2026-12-01", durationMonths: 12,
};
const original = buildAgreement(terms);
const originalHash = hashDocument(original);
let changed = 0;
let tried = 0;
for (let i = 0; i < original.length; i++) {
  const ch = original[i];
  if (ch === "\n" || ch === " ") continue; // whitespace edits are normalised on purpose (see canonicalizeDocument)
  const replacement = ch === "x" ? "y" : "x";
  tried += 1;
  if (hashDocument(original.slice(0, i) + replacement + original.slice(i + 1)) !== originalHash) changed += 1;
}
console.log("\nTamper sweep on a generated Lagos agreement");
console.log(`  agreement length                    : ${original.length} characters`);
console.log(`  single-character edits tried        : ${tried}`);
console.log(`  edits that changed the fingerprint  : ${changed}/${tried}`);
console.log(`  same text hashed twice is identical : ${hashDocument(original) === hashDocument(original)}`);
