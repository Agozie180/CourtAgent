import { checkAdvanceRentFor } from "./tenancy-rules";

export type RiskLevel = "Low" | "Medium" | "High";
export type Severity = "high" | "medium" | "low";

export type RiskFlag = {
  id: string;
  severity: Severity;
  message: string;
  source: "rules" | "ai";
};

export type CheckInput = {
  /** Nigerian state of the property, or "FCT". Statutory checks run only for states CourtAgent has verified. */
  state: string;
  claimedLandlordName: string;
  /** Text copied from the landlord's documents, receipts, WhatsApp messages or listing. */
  documentText: string;
  advanceMonths: number | null;
  answers: {
    inspectedInPerson: boolean;
    sawOriginalTitle: boolean;
    dealingWithAgent: boolean;
    agentHasAuthorityLetter: boolean;
    askedToPayBeforeViewing: boolean;
    paymentToPersonalAccount: boolean;
    receiptPromised: boolean;
  };
};

export type CheckResult = {
  level: RiskLevel;
  score: number;
  flags: RiskFlag[];
  reminder: string;
};

const WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

const TEXT_PATTERNS: { id: string; severity: Severity; pattern: RegExp; message: string }[] = [
  {
    id: "TEXT_PRESSURE",
    severity: "medium",
    pattern: /pay (today|now|immediately)|last (unit|flat|apartment)|many (people|persons) (are )?(interested|waiting)|hurry|urgent(ly)?|before (someone|another person)/i,
    message: "The text pushes you to pay quickly. Scammers use pressure so you skip checks.",
  },
  {
    id: "TEXT_CRYPTO_GIFTCARD",
    severity: "high",
    pattern: /gift ?card|bitcoin|usdt|crypto(currency)? (payment|transfer)|western union|moneygram/i,
    message: "The text asks for payment by gift card, crypto or a money-transfer service. Real landlords take bank transfers to a named account.",
  },
  {
    id: "TEXT_ABROAD",
    severity: "high",
    pattern: /(i am|i'm|currently) (abroad|outside (the )?country|travell?ing)|send (you )?the keys? (by|through) (courier|dhl)|keys? will be (sent|couriered)/i,
    message: "The landlord says they are abroad and will send keys later. This is a common rental scam pattern.",
  },
  {
    id: "TEXT_NO_AGREEMENT",
    severity: "medium",
    pattern: /agreement (later|after)|no agreement|sign (later|after)|verbal agreement/i,
    message: "The text avoids giving you a written agreement now. Do not pay before you have one.",
  },
  {
    id: "TEXT_NO_REFUND",
    severity: "low",
    pattern: /non[- ]?refundable|no refund/i,
    message: "The text says payments are not refundable. Check what you would lose if the place turns out not to be genuine.",
  },
];

function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b(mr|mrs|miss|ms|chief|dr|engr|alhaji|alhaja|pastor|barr)\.?\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1);
}

/** True when every part of the claimed name appears in the text. */
export function nameAppearsIn(name: string, text: string): boolean {
  const parts = normalizeName(name);
  if (parts.length === 0) return true;
  const haystack = text.toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

export function levelFor(score: number): RiskLevel {
  if (score >= 5) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

export function runRulesCheck(input: CheckInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const add = (id: string, severity: Severity, message: string) => flags.push({ id, severity, message, source: "rules" });
  const { answers } = input;

  if (input.advanceMonths !== null) {
    const advance = checkAdvanceRentFor(input.state, input.advanceMonths);
    if (!advance.ok) add("ADVANCE_OVER_LIMIT", "high", advance.message);
    else if (!advance.checked) add("ADVANCE_UNCHECKED", "low", advance.message);
  }
  if (!answers.inspectedInPerson) {
    add("NOT_INSPECTED", "high", "You have not inspected the property in person. Never pay for a place you have not seen.");
  }
  if (answers.askedToPayBeforeViewing) {
    add("PAY_BEFORE_VIEWING", "high", "You were asked to pay before viewing the property or signing anything.");
  }
  if (!answers.sawOriginalTitle) {
    add("NO_TITLE_SEEN", "medium", "You have not seen the landlord's original ownership document (for example the title or deed). Ask to see it.");
  }
  if (answers.dealingWithAgent && !answers.agentHasAuthorityLetter) {
    add("AGENT_NO_AUTHORITY", "high", "You are dealing with an agent who has not shown a letter from the owner allowing them to let the property.");
  }
  if (answers.paymentToPersonalAccount) {
    add("PERSONAL_ACCOUNT", "medium", "You are asked to pay into an account that does not carry the landlord's name. Pay only to the person named on the agreement.");
  }
  if (!answers.receiptPromised) {
    add("NO_RECEIPT", "medium", "No receipt has been promised. Insist on a receipt for every payment, showing the date, amount and period it covers.");
  }

  const text = input.documentText.trim();
  if (text.length > 0 && input.claimedLandlordName.trim().length > 0 && !nameAppearsIn(input.claimedLandlordName, text)) {
    add("NAME_MISMATCH", "high", `The landlord name "${input.claimedLandlordName}" does not appear in the documents you pasted. The owner and the person asking for money may be different people.`);
  }
  for (const rule of TEXT_PATTERNS) {
    if (text && rule.pattern.test(text)) add(rule.id, rule.severity, rule.message);
  }
  return flags;
}

export function summarizeRisk(flags: RiskFlag[]): CheckResult {
  const score = flags.reduce((total, flag) => total + WEIGHT[flag.severity], 0);
  return {
    level: levelFor(score),
    score,
    flags,
    reminder:
      "This is a warning check, not proof. A Low result does not prove a property is genuine: always inspect it, see the owner's documents and get a written agreement before paying.",
  };
}

export function runCheck(input: CheckInput, extraFlags: RiskFlag[] = []): CheckResult {
  const seen = new Set<string>();
  const merged = [...runRulesCheck(input), ...extraFlags].filter((flag) => {
    const key = `${flag.id}:${flag.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return summarizeRisk(merged);
}
