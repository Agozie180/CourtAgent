/**
 * A small labelled set of landlord messages, written by the author from common Nigerian rental scam patterns and
 * from ordinary honest messages. It is a regression suite and a demo source, NOT an accuracy claim: it is tiny,
 * it was written by the person who wrote the rules, and real scams are more varied. See AUDIT.md.
 */
export type CorpusItem = { id: string; label: "scam" | "legit"; text: string; why: string };

export const CORPUS: CorpusItem[] = [
  { id: "S01", label: "scam", why: "abroad + keys by courier + pay today", text: "Hello, I am currently abroad on a mission. Pay the full rent today and I will send the keys by courier." },
  { id: "S02", label: "scam", why: "gift card / crypto + pressure", text: "Last flat, many people are waiting. Send payment in bitcoin or gift card immediately." },
  { id: "S03", label: "scam", why: "inspection fee before viewing", text: "Pay an inspection fee of 50,000 naira first, then my agent will show you the flat." },
  { id: "S04", label: "scam", why: "no agreement until after payment", text: "We will sign the agreement later, after you pay. Verbal agreement is fine for now." },
  { id: "S05", label: "scam", why: "owner overseas, cannot meet, personal account", text: "I'm a nurse in the UK so I cannot meet you. Pay into my cousin's personal account and he will give you the keys." },
  { id: "S06", label: "scam", why: "pay to secure, pressure", text: "Pay 300k now to secure the apartment before another person takes it." },
  { id: "S07", label: "scam", why: "western union + abroad", text: "I am abroad. Send the money by Western Union, the keys will be couriered to you." },
  { id: "S08", label: "scam", why: "no need to inspect", text: "There is no need to come and inspect the house, the photos are exactly as it is. Just pay." },
  { id: "S09", label: "scam", why: "military posting + courier + non-refundable", text: "I am on a military posting overseas. Payment is non-refundable and keys will be sent by DHL." },
  { id: "S10", label: "scam", why: "booking fee + urgency", text: "A booking fee is required urgently to hold the flat, pay today." },
  { id: "S11", label: "scam", why: "crypto payment", text: "We accept USDT only for this flat. Send crypto payment to the wallet below." },
  { id: "S12", label: "scam", why: "hurry + sign later", text: "Hurry, many persons are interested. We can sign after you transfer the money." },
  { id: "S13", label: "scam", why: "oil rig / offshore owner", text: "I work offshore on an oil rig and cannot be there. My lawyer will collect the rent for the flat." },
  { id: "S14", label: "scam", why: "viewing fee", text: "Pay a viewing fee into this account before you see the property." },
  { id: "L01", label: "legit", why: "plain, agreement and receipt promised", text: "Flat 3, 12 Akin Adesola Street, Lekki. Rent is NGN 1,200,000 a year. You can inspect on Saturday. An agreement and a receipt will be given when you pay." },
  { id: "L02", label: "legit", why: "draft agreement shared for review", text: "Thank you for visiting. Attached is the draft tenancy agreement. Please read it with your lawyer before you sign." },
  { id: "L03", label: "legit", why: "bank transfer to named account, refundable deposit", text: "The caution deposit is refundable. Rent is paid by bank transfer to the account named on the agreement, and a receipt is issued." },
  { id: "L04", label: "legit", why: "ordinary agency fee", text: "The agency fee is 10 percent as agreed and is paid on signing. A receipt will be issued." },
  { id: "L05", label: "legit", why: "local landlord offers meeting with title", text: "I live in Lagos and can meet you at the property on Friday with my title document." },
  { id: "L06", label: "legit", why: "travelling but authorised representative", text: "I am travelling next week, but my brother Tunde will show you the flat. He has my signed authority letter." },
  { id: "L07", label: "legit", why: "inspection invitation", text: "You are welcome to inspect the flat any weekday after 4pm. Bring a friend if you like." },
  { id: "L08", label: "legit", why: "diaspora landlord with local agent and papers", text: "The owner lives in Canada, but the licensed agent has the owner's letter of authority and will meet you at the flat with the documents." },
  { id: "L09", label: "legit", why: "no pressure", text: "Take your time to decide. The flat will stay available until Monday and you may bring a lawyer to read the agreement." },
  { id: "L10", label: "legit", why: "payment after signing, receipt", text: "Payment is made after both of us sign the agreement, and I will issue a stamped receipt for every payment." },
  { id: "L11", label: "legit", why: "mentions fees and refund policy", text: "The deposit is returned within 30 days if the flat is not as described in the agreement." },
  { id: "L12", label: "legit", why: "ordinary description", text: "Two bedroom flat with parlour, prepaid meter, borehole water, security at the gate, close to the bus stop." },
];

/**
 * HELD-OUT set. Written AFTER the rules above were frozen and never used to change a rule, so it is the honest
 * estimate of how the text rules do on wording they were not built around. Do not tune rules on these items.
 */
export const HELD_OUT: CorpusItem[] = [
  { id: "H01", label: "scam", why: "overseas city not in the rules, mail the keys", text: "Dear tenant, because of my work in Houston I can't attend the viewing. Send one year rent and I will mail the keys to you." },
  { id: "H02", label: "scam", why: "too-good price, pay to confirm", text: "Brand new 3 bedroom in Lekki, N300k per year only. Pay the full amount to the account below to confirm." },
  { id: "H03", label: "scam", why: "company account, pressure without the usual words", text: "Our company manages the property. Transfer the deposit to our account today to avoid losing the flat." },
  { id: "H04", label: "scam", why: "UN staff abroad", text: "I am a UN staff member currently serving in a conflict zone. My assistant will collect the rent for me." },
  { id: "H05", label: "scam", why: "half now, keys by DHL", text: "Pay 50 percent now and the balance when I send the keys by DHL." },
  { id: "H06", label: "scam", why: "asks for passport and BVN first", text: "Send your passport copy and BVN so we can reserve the apartment for you, then pay the caution deposit." },
  { id: "H07", label: "scam", why: "secret off-the-books letting", text: "Do not tell the caretaker. I want to rent it to you quietly at half price, so pay me directly." },
  { id: "H08", label: "scam", why: "cannot come, everything by email", text: "I will not be able to come to Nigeria this year. Everything will be handled by email." },
  { id: "H09", label: "scam", why: "crypto to hold the flat", text: "Kindly pay via crypto payment to this wallet to hold the flat." },
  { id: "H10", label: "scam", why: "gift cards accepted", text: "Limited offer. Gift card of any kind is accepted for the rent." },
  { id: "HL01", label: "legit", why: "own-name account matching the title", text: "Rent is 800k a year. Pay by transfer into my GTBank account in my own name, the same name that is on the title document." },
  { id: "HL02", label: "legit", why: "viewing by appointment", text: "Viewing is by appointment. Kindly call the caretaker to arrange a time that suits you." },
  { id: "HL03", label: "legit", why: "local owner with agent", text: "I currently live in Abuja, so my agent Mrs Eze will meet you at the flat." },
  { id: "HL04", label: "legit", why: "diaspora owner with lawyer and power of attorney", text: "I am abroad for work but I have appointed a lawyer, Barr Obi, with a power of attorney to handle the letting. You can meet him at his chambers." },
  { id: "HL05", label: "legit", why: "booking confirmed only after signing", text: "The caution fee is refundable and the booking is confirmed only after the agreement is signed by both of us." },
  { id: "HL06", label: "legit", why: "agreement fee at lawyer office with receipt", text: "Please pay the agreement fee at the lawyer's office when you sign, and collect a receipt." },
  { id: "HL07", label: "legit", why: "ordinary scheduling", text: "You can see the flat tomorrow at 10am. If you like it, we move to the paperwork." },
  { id: "HL08", label: "legit", why: "reschedules a meeting", text: "I can't meet you on Saturday but I can on Sunday." },
];

/** What a tenant who inspected, saw the title and was promised a receipt would answer: only the text can raise flags. */
export const NEUTRAL_ANSWERS = {
  inspectedInPerson: true,
  sawOriginalTitle: true,
  dealingWithAgent: false,
  agentHasAuthorityLetter: false,
  askedToPayBeforeViewing: false,
  paymentToPersonalAccount: false,
  receiptPromised: true,
};

/** Three one-tap examples for the homepage, taken from the corpus. */
export const HOME_EXAMPLES: { label: string; id: string }[] = [
  { label: "Landlord abroad, keys by courier", id: "S01" },
  { label: "Pay in bitcoin, hurry", id: "S02" },
  { label: "Honest message", id: "L01" },
];
