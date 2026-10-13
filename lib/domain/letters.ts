import { endDate, noticeText } from "./agreement";
import { formatNgn } from "./intake";
import { DISCLAIMER, TENANCY_TYPE_LABEL, type TenancyType } from "./lagos-tenancy";
import { stateLabel } from "./jurisdiction";
import { evictionNoteFor } from "./tenancy-rules";

export type LetterResult = { letter: string; notes: string[] };

// ---------------------------------------------------------------------------------------------
// Tenant's reply when a landlord demands the tenant leave early
// ---------------------------------------------------------------------------------------------

export type ExitLetterInput = {
  state: string;
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  startDate: string;
  durationMonths: number;
  tenancyType: TenancyType;
  agreedNotice?: string;
  advanceMonths: number;
  annualRentNgn: number;
  agreementHash: string;
  fullySigned: boolean;
  demandDate: string; // YYYY-MM-DD
  demandSummary: string; // what the landlord said or did, in the tenant's words
  letterDate: string; // YYYY-MM-DD
};

export function buildExitResponseLetter(input: ExitLetterInput): LetterResult {
  const end = endDate(input.startDate, input.durationMonths);
  const notice = noticeText(input);
  const advance = Math.round((input.annualRentNgn / 12) * input.advanceMonths);
  const record = input.fullySigned
    ? `A record of this agreement, signed by both of us, is on the Ethereum Sepolia test network under the hash ${input.agreementHash}.`
    : `A record of this agreement is on the Ethereum Sepolia test network under the hash ${input.agreementHash}.`;

  const letter = `${input.letterDate}

To: ${input.landlordName}
From: ${input.tenantName}

RE: MY TENANCY AT ${input.propertyAddress.toUpperCase()}: RESPONSE TO YOUR DEMAND THAT I LEAVE

Dear ${input.landlordName},

1. We signed a tenancy agreement for the property above. It is a ${TENANCY_TYPE_LABEL[input.tenancyType]} that started on ${input.startDate} and runs to ${end}. I paid ${input.advanceMonths} months of rent in advance, which is ${formatNgn(advance)}. ${record}

2. On ${input.demandDate} you ${input.demandSummary.trim().replace(/[.]+$/, "")}. I did not agree to leave on that basis.

3. Our agreement says that ${
    input.tenancyType === "fixed_term" && !input.agreedNotice
      ? "no notice is needed once the fixed term ends"
      : `the notice to end the tenancy is ${notice}`
  }. You have not given me a valid notice to quit that meets this.

4. ${evictionNoteFor(input.state)} Until that process is completed I remain in lawful possession of the property and I will keep paying rent as we agreed.

5. I ask you to withdraw your demand in writing within 7 days. Please do not change the locks, remove my belongings, cut off water or electricity, or threaten or harass me or my family. Any such action would be unlawful, and I will take advice on my remedies.

6. I would rather settle this peacefully. I am willing to discuss it in writing, or through a lawyer or a neutral mediator.

I keep a copy of this letter and the signed agreement. All my rights are reserved.

Yours faithfully,
${input.tenantName}

---
${DISCLAIMER}`;

  const notes = [
    "Send this letter in a way you can prove: hand delivery with a signed acknowledgement, email, or a message you screenshot. Keep a copy.",
    "Keep your signed agreement, your rent receipts and proof of every payment together in one safe place.",
    "Do not leave the property or sign anything because of pressure or threats. Ask for any demand in writing.",
    "If you feel unsafe or the landlord uses force, contact the police and a lawyer straight away.",
    "For free or low-cost legal help, you can contact the Legal Aid Council of Nigeria, FIDA Nigeria, or the Lagos State Office of the Public Defender. Check their current contact details first.",
    "The on-chain record supports your agreement; a court will mainly look at the signed agreement itself and your receipts. Have a lawyer check the letter before you send it.",
  ];
  return { letter, notes };
}

// ---------------------------------------------------------------------------------------------
// Widow's notice to relatives who try to take her home or property
// ---------------------------------------------------------------------------------------------

export type MarriageType = "statutory" | "customary" | "unsure";

export type WidowLetterInput = {
  state: string;
  widowName: string;
  deceasedName: string;
  propertyDescription: string;
  recordHash: string;
  recordDate: string; // YYYY-MM-DD, the day the property record was registered
  marriageType: MarriageType;
  hasWill: boolean;
  hasDaughters: boolean;
  addressedTo: string; // for example "The family of the late Mr Okoro"
  letterDate: string; // YYYY-MM-DD
};

export function buildWidowLetter(input: WidowLetterInput): LetterResult {
  const legalLines: string[] = [
    "Nigerian courts, including the Supreme Court, have recognised that a widow is entitled to remain in occupation of her late husband's property.",
  ];
  if (input.hasDaughters) {
    legalLines.push(
      "The Supreme Court has also held, in Ukeje v Ukeje (2014), that a customary rule which stops a female child from inheriting from her father is void because it breaches the Constitution.",
    );
  }
  if (input.marriageType === "statutory" && input.state === "Lagos") {
    legalLines.push(
      "Our marriage was celebrated under the Marriage Act. Where such a husband dies in Lagos without a will, the Administration of Estates Law of Lagos State, 2015 governs how his estate is shared, not customary rules.",
    );
  } else if (input.marriageType === "statutory") {
    legalLines.push(
      `Our marriage was celebrated under the Marriage Act. I am taking legal advice on how the law of ${stateLabel(input.state)} applies to the estate of a husband married under that Act, and I ask that nothing is done until that is settled.`,
    );
  } else if (input.marriageType === "customary") {
    legalLines.push(
      "Our marriage was a customary marriage. I am taking legal advice on the law that applies to his estate, and I ask that nothing is done until that is settled.",
    );
  } else {
    legalLines.push("I am taking legal advice on the law that applies to my late husband's estate.");
  }

  const willLine = input.hasWill
    ? `My late husband left a will. I ask that it is dealt with through the proper legal process.\n\n`
    : "";

  const letter = `${input.letterDate}

To: ${input.addressedTo}
From: ${input.widowName}

RE: NOTICE OF MY LAWFUL OCCUPATION OF THE PROPERTY OF THE LATE ${input.deceasedName.toUpperCase()}, AND REQUEST TO FOLLOW THE LAW

1. I am the widow of the late ${input.deceasedName}. I live in and use the property described as: ${input.propertyDescription}.

2. A record of this property and its documents was registered on ${input.recordDate}. The record is on the Ethereum Sepolia test network under the hash ${input.recordHash}, so the documents cannot be quietly changed after that date.

3. ${legalLines.join(" ")}

${willLine}4. I ask that no person removes me from the property, changes its locks, sells or lets it, collects its rent, or takes any of its contents or documents unless a court has ordered it or the proper legal grant (probate or letters of administration) has been obtained and I have been properly notified.

5. I respect the family's grief and I am willing to discuss the estate calmly, in writing, through lawyers or through a mediator or elders we both trust.

6. This letter is a notice. It is not a court order, and it does not on its own decide who owns what.

Yours faithfully,
${input.widowName}

---
${DISCLAIMER}`;

  const notes = [
    "Speak to a lawyer as soon as you can, ideally before sending this letter. The law depends on the kind of marriage, whether there is a will, and the state.",
    "For free or low-cost help, you can contact the Legal Aid Council of Nigeria, FIDA Nigeria, or the Lagos State Office of the Public Defender. Check their current contact details first.",
    "Keep originals or copies of the marriage certificate, the property documents, receipts, any will and the death certificate in a safe place, and give a trusted person a copy.",
    "Do not sign any paper under pressure. Ask for every demand in writing.",
    "If you are threatened or in danger, contact the police and a trusted person right away.",
    "Probate (if there is a will) or letters of administration (if there is none) is obtained through the court. A lawyer can help you apply.",
  ];
  return { letter, notes };
}
