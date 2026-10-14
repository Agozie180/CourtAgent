"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Address } from "viem";
import { postJson } from "@/lib/api/client";
import { saveDocument } from "@/lib/storage";
import { buildVerifyPath } from "@/lib/share";
import { hashDocument } from "@/lib/hash/document";
import type { RegistryRecord, TxResult } from "@/lib/chain/types";
import { DEMO_LANDLORD, DEMO_TENANT } from "@/lib/chain/demo";
import { buildAgreement, validateTerms, type TenancyTerms } from "@/lib/domain/agreement";
import {
  describeFields,
  emptyIntake,
  formatNgn,
  isComplete,
  nextMissing,
  questionFor,
  type IntakeFields,
  type IntakeKey,
} from "@/lib/domain/intake";
import { stateLabel } from "@/lib/domain/jurisdiction";
import { buildExitResponseLetter } from "@/lib/domain/letters";
import type { RiskFlag, RiskLevel } from "@/lib/domain/risk";
import { ruleFor, unverifiedNote } from "@/lib/domain/tenancy-rules";
import { CopyButton, DocumentSheet, HashLine, Notice, TxLine, errorMessage } from "./bits";
import { RecordStatus } from "./record-status";
import { useSession } from "./session-provider";

type Step = "details" | "check" | "agreement" | "record" | "after";
const STEPS: { id: Step; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "check", label: "Check the landlord" },
  { id: "agreement", label: "Agreement" },
  { id: "record", label: "Record and sign" },
  { id: "after", label: "If the landlord pushes" },
];

type Message = { role: "agent" | "you"; text: string };
type IntakeResponse = { fields: IntakeFields; next: IntakeKey | null; reply: string; provider: string };
type CheckResponse = { level: RiskLevel; score: number; flags: RiskFlag[]; reminder: string; provider: string };
type ExplainResponse = { points: string[]; provider: string };

const ANSWER_QUESTIONS = {
  inspectedInPerson: "Have you visited and inspected the property yourself?",
  sawOriginalTitle: "Have you seen the landlord's original ownership document (title, deed or allocation letter)?",
  dealingWithAgent: "Are you dealing with an agent instead of the owner?",
  agentHasAuthorityLetter: "Has the agent shown you a letter from the owner allowing them to let the property?",
  askedToPayBeforeViewing: "Were you asked to pay before you viewed the property or signed anything?",
  paymentToPersonalAccount: "Are you asked to pay into an account that does not carry the landlord's name?",
  receiptPromised: "Has the landlord promised a receipt for every payment?",
} as const;
type AnswerKey = keyof typeof ANSWER_QUESTIONS;

const todayIso = () => new Date().toISOString().slice(0, 10);

function providerNote(provider: string): string {
  return provider === "offline"
    ? "Built-in rules only. No AI key is set, and everything still works."
    : `Rules plus notes from ${provider === "anthropic" ? "Anthropic" : "OpenAI"}.`;
}

export function RentFlow() {
  const session = useSession();
  const [step, setStep] = useState<Step>("details");

  // Step 1
  const [fields, setFields] = useState<IntakeFields>(emptyIntake());
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", text: questionFor("state") }]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [intakeProvider, setIntakeProvider] = useState("offline");
  const logRef = useRef<HTMLDivElement>(null);

  // Step 2
  const [documentText, setDocumentText] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<AnswerKey, boolean>>>({});
  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Step 3
  const [propertyAddress, setPropertyAddress] = useState("");
  const [tenantWallet, setTenantWallet] = useState("");
  const [landlordWallet, setLandlordWallet] = useState("");
  const [agreedNotice, setAgreedNotice] = useState("");
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  // Step 4
  const [record, setRecord] = useState<RegistryRecord | null>(null);
  const [txs, setTxs] = useState<TxResult[]>([]);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  // Step 5
  const [demandDate, setDemandDate] = useState("");
  const [demandSummary, setDemandSummary] = useState("");
  const [letterDate, setLetterDate] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setDemandDate(todayIso());
    setLetterDate(todayIso());
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  // Pre-fill the two wallet addresses for the chosen mode.
  useEffect(() => {
    if (session.mode === "demo") {
      setTenantWallet(DEMO_TENANT);
      setLandlordWallet(DEMO_LANDLORD);
    } else {
      setTenantWallet(session.walletAccount ?? "");
      setLandlordWallet("");
    }
  }, [session.mode, session.walletAccount]);

  const terms = useMemo<TenancyTerms | null>(() => {
    const f = fields;
    if (
      f.state === null || f.bedrooms === null || f.parlour === null || !f.landlordName || !f.tenantName ||
      f.annualRentNgn === null || f.advanceMonths === null || f.cautionNgn === null || f.tenancyType === null ||
      !f.startDate || f.durationMonths === null
    ) {
      return null;
    }
    return {
      state: f.state,
      landlordName: f.landlordName,
      tenantName: f.tenantName,
      landlordWallet: landlordWallet.trim(),
      tenantWallet: tenantWallet.trim(),
      propertyAddress: propertyAddress.trim(),
      bedrooms: f.bedrooms,
      parlour: f.parlour,
      annualRentNgn: f.annualRentNgn,
      advanceMonths: f.advanceMonths,
      cautionNgn: f.cautionNgn,
      tenancyType: f.tenancyType,
      startDate: f.startDate,
      durationMonths: f.durationMonths,
      agreedNotice: agreedNotice.trim() || undefined,
    };
  }, [fields, landlordWallet, tenantWallet, propertyAddress, agreedNotice]);

  const issues = useMemo(() => (terms ? validateTerms(terms) : []), [terms]);
  const agreementText = terms && issues.length === 0 ? buildAgreement(terms) : "";
  const hash = agreementText ? hashDocument(agreementText) : null;

  const refreshRecord = useCallback(async () => {
    if (!hash) {
      setRecord(null);
      return;
    }
    try {
      setRecord(await session.registry.getRecord(hash));
    } catch (error) {
      setChainError(errorMessage(error));
    }
  }, [hash, session.registry]);

  useEffect(() => {
    void refreshRecord();
  }, [refreshRecord]);

  const unlocked: Record<Step, boolean> = {
    details: true,
    check: isComplete(fields),
    agreement: check !== null,
    record: agreementText !== "",
    after: record !== null,
  };

  // ---------------------------------------------------------------- step 1
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || chatBusy) return;
    setInput("");
    setMessages((list) => [...list, { role: "you", text }]);
    setChatBusy(true);
    try {
      const result = await postJson<IntakeResponse>("/api/intake", { message: text, fields, expected: nextMissing(fields) });
      setFields(result.fields);
      setIntakeProvider(result.provider);
      setMessages((list) => [...list, { role: "agent", text: result.reply }]);
    } catch (error) {
      setMessages((list) => [...list, { role: "agent", text: `${errorMessage(error)} Send your answer again.` }]);
    } finally {
      setChatBusy(false);
    }
  }

  function startOver() {
    setFields(emptyIntake());
    setMessages([{ role: "agent", text: questionFor("state") }]);
    setCheck(null);
    setRecord(null);
    setTxs([]);
    setExplain(null);
    setAnswers({});
    setDocumentText("");
    setStep("details");
  }

  // ---------------------------------------------------------------- step 2
  const needAgentLetter = answers.dealingWithAgent === true;
  const requiredAnswers = (Object.keys(ANSWER_QUESTIONS) as AnswerKey[]).filter(
    (key) => key !== "agentHasAuthorityLetter" || needAgentLetter,
  );
  const allAnswered = requiredAnswers.every((key) => typeof answers[key] === "boolean");

  async function runCheck(event: FormEvent) {
    event.preventDefault();
    if (!allAnswered || !fields.state || !fields.landlordName) return;
    setCheckBusy(true);
    setCheckError(null);
    try {
      const body = {
        state: fields.state,
        claimedLandlordName: fields.landlordName,
        documentText,
        advanceMonths: fields.advanceMonths,
        answers: {
          inspectedInPerson: answers.inspectedInPerson,
          sawOriginalTitle: answers.sawOriginalTitle,
          dealingWithAgent: answers.dealingWithAgent,
          agentHasAuthorityLetter: needAgentLetter ? answers.agentHasAuthorityLetter : false,
          askedToPayBeforeViewing: answers.askedToPayBeforeViewing,
          paymentToPersonalAccount: answers.paymentToPersonalAccount,
          receiptPromised: answers.receiptPromised,
        },
      };
      setCheck(await postJson<CheckResponse>("/api/check", body));
    } catch (error) {
      setCheckError(errorMessage(error));
    } finally {
      setCheckBusy(false);
    }
  }

  // ---------------------------------------------------------------- step 3
  async function explainAgreementNow() {
    if (!terms || issues.length > 0) return;
    setExplainBusy(true);
    setExplainError(null);
    try {
      setExplain(await postJson<ExplainResponse>("/api/explain", { terms }));
    } catch (error) {
      setExplainError(errorMessage(error));
    } finally {
      setExplainBusy(false);
    }
  }

  // ---------------------------------------------------------------- step 4
  const account = session.account;
  const isParty =
    account !== null &&
    terms !== null &&
    [terms.tenantWallet, terms.landlordWallet].some((wallet) => wallet.toLowerCase() === account.toLowerCase());
  const alreadySigned =
    record !== null && account !== null
      ? record.parties.some((party, index) => party.toLowerCase() === account.toLowerCase() && record.signed[index])
      : false;

  async function registerAndSign() {
    if (!hash || !terms) return;
    setChainBusy(true);
    setChainError(null);
    try {
      const done: TxResult[] = [];
      const existing = await session.registry.getRecord(hash);
      if (!existing) {
        done.push(
          await session.registry.register(hash, "TENANCY_AGREEMENT", [terms.tenantWallet as Address, terms.landlordWallet as Address]),
        );
      }
      done.push(await session.registry.sign(hash));
      setTxs((list) => [...list, ...done]);
      saveDocument({
        kind: "TENANCY_AGREEMENT",
        hash,
        text: agreementText,
        createdAt: new Date().toISOString(),
        source: session.registry.source,
        terms,
      });
      await refreshRecord();
    } catch (error) {
      setChainError(errorMessage(error));
    } finally {
      setChainBusy(false);
    }
  }

  async function signOnly() {
    if (!hash) return;
    setChainBusy(true);
    setChainError(null);
    try {
      const tx = await session.registry.sign(hash);
      setTxs((list) => [...list, tx]);
      await refreshRecord();
    } catch (error) {
      setChainError(errorMessage(error));
    } finally {
      setChainBusy(false);
    }
  }

  const shareUrl = agreementText && origin ? `${origin}${buildVerifyPath(agreementText)}` : "";

  // ---------------------------------------------------------------- step 5
  const letter = useMemo(() => {
    if (!terms || !hash || !record || !demandSummary.trim() || !demandDate || !letterDate) return null;
    return buildExitResponseLetter({
      state: terms.state,
      tenantName: terms.tenantName,
      landlordName: terms.landlordName,
      propertyAddress: terms.propertyAddress,
      startDate: terms.startDate,
      durationMonths: terms.durationMonths,
      tenancyType: terms.tenancyType,
      agreedNotice: terms.agreedNotice,
      advanceMonths: terms.advanceMonths,
      annualRentNgn: terms.annualRentNgn,
      agreementHash: hash,
      fullySigned: record.fullySignedAt > 0,
      recordLocation: record.source === "chain" ? "sepolia" : "demo",
      demandDate,
      demandSummary,
      letterDate,
    });
  }, [terms, hash, record, demandSummary, demandDate, letterDate]);

  // ---------------------------------------------------------------- render
  const factLines = describeFields(fields);
  const overBudget =
    fields.annualRentNgn !== null && fields.budgetNgn !== null && fields.annualRentNgn > fields.budgetNgn;
  const stateRule = fields.state ? ruleFor(fields.state) : null;

  return (
    <div>
      <div className="flow-steps" role="list" aria-label="Steps">
        {STEPS.map((item, index) => {
          const reachable = unlocked[item.id];
          const current = step === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={reachable && !current ? "done" : ""}
              aria-current={current ? "step" : undefined}
              disabled={!reachable}
              onClick={() => setStep(item.id)}
            >
              {index + 1}. {item.label}
            </button>
          );
        })}
      </div>

      {step === "details" ? (
        <div className="flow-layout">
          <div>
            <div className="chat">
              <div className="chat-log" ref={logRef} aria-live="polite">
                {messages.map((message, index) => (
                  <div key={index} className={`bubble ${message.role}`}>
                    {message.text}
                  </div>
                ))}
              </div>
              <form className="chat-form" onSubmit={sendMessage}>
                <label htmlFor="chat-input" className="visually-hidden" style={{ position: "absolute", left: -9999 }}>
                  Your answer
                </label>
                <input
                  id="chat-input"
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={isComplete(fields) ? "All set. Review the details." : "Type your answer"}
                  disabled={chatBusy || isComplete(fields)}
                  autoComplete="off"
                />
                <button type="submit" className="button" disabled={chatBusy || !input.trim() || isComplete(fields)}>
                  {chatBusy ? "Sending…" : "Send"}
                </button>
              </form>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>{providerNote(intakeProvider)}</p>
            <div className="button-row">
              <button type="button" className="button yellow" disabled={!isComplete(fields)} onClick={() => setStep("check")}>
                Continue to the landlord check
              </button>
              <button type="button" className="button ghost small" onClick={startOver}>
                Start over
              </button>
            </div>
          </div>
          <aside className="facts" aria-label="Details so far">
            <h3>Details so far</h3>
            {factLines.length === 0 ? (
              <p className="hint">Your answers will appear here.</p>
            ) : (
              <ul>
                {factLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {overBudget ? (
              <Notice tone="warn">The yearly rent is above the budget you gave. Decide if you can afford it before you go on.</Notice>
            ) : null}
            {fields.state && !stateRule ? <Notice tone="warn">{unverifiedNote(fields.state)}</Notice> : null}
            {fields.state && stateRule ? (
              <p className="hint">Tenancy rules for {stateLabel(fields.state)} were checked on {stateRule.verifiedOn}.</p>
            ) : null}
          </aside>
        </div>
      ) : null}

      {step === "check" ? (
        <form onSubmit={runCheck}>
          <h2>Check the landlord before you pay</h2>
          <p>
            Paste anything the landlord or agent sent you: a listing, a WhatsApp message, a receipt or an allocation
            letter. It stays between you and this check.
          </p>
          <div className="field">
            <label htmlFor="doc-text">
              What the landlord sent <span className="hint">Optional, but it helps the check</span>
            </label>
            <textarea id="doc-text" value={documentText} onChange={(event) => setDocumentText(event.target.value)} maxLength={8000} />
          </div>
          <div role="group" aria-label="Seven questions">
            {requiredAnswers.map((key) => (
              <div className="check-row" key={key}>
                <span>{ANSWER_QUESTIONS[key]}</span>
                <div className="yesno" role="group" aria-label={ANSWER_QUESTIONS[key]}>
                  <button type="button" aria-pressed={answers[key] === true} onClick={() => setAnswers((a) => ({ ...a, [key]: true }))}>
                    Yes
                  </button>
                  <button type="button" aria-pressed={answers[key] === false} onClick={() => setAnswers((a) => ({ ...a, [key]: false }))}>
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>
          {checkError ? <Notice tone="error">{checkError}</Notice> : null}
          <div className="button-row">
            <button type="submit" className="button yellow" disabled={!allAnswered || checkBusy}>
              {checkBusy ? "Checking…" : check ? "Check again" : "Run the check"}
            </button>
          </div>

          {check ? (
            <section aria-live="polite" style={{ marginTop: 32 }}>
              <div className="risk-head">
                <p className={`stamp static ${check.level === "Low" ? "" : check.level === "Medium" ? "amber" : "red"}`}>
                  {check.level.toUpperCase()} RISK
                </p>
                <p style={{ margin: 0 }}>
                  {check.flags.length === 0
                    ? "No warning signs found in what you told me."
                    : `${check.flags.length} warning ${check.flags.length === 1 ? "sign" : "signs"} found.`}
                </p>
              </div>
              {check.flags.length > 0 ? (
                <ul className="flag-list">
                  {check.flags.map((flag) => (
                    <li key={`${flag.id}-${flag.message}`} className={flag.severity}>
                      {flag.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {check.level === "High" ? (
                <Notice tone="error">Do not pay anything yet. Fix the high-risk signs above, or walk away.</Notice>
              ) : null}
              <Notice>{check.reminder}</Notice>
              <p className="hint">{providerNote(check.provider)}</p>
              <div className="button-row">
                <button type="button" className="button" onClick={() => setStep("agreement")}>
                  Continue to the agreement
                </button>
              </div>
            </section>
          ) : null}
        </form>
      ) : null}

      {step === "agreement" && terms ? (
        <div>
          <h2>Your agreement</h2>
          <p>
            These terms come from your answers. Add the property address and the two wallet addresses, and the agreement
            is written for you. The wording is a fixed template. The AI never changes it.
          </p>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="address">Property address</label>
              <input id="address" type="text" value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} placeholder="Flat 3, 12 Akin Adesola Street, Lekki" />
            </div>
            <div className="field">
              <label htmlFor="notice">
                Notice period you both agree <span className="hint">{stateRule ? "Optional. Leave empty to use the default for the tenancy type." : "Required for this state, for example 3 months."}</span>
              </label>
              <input id="notice" type="text" value={agreedNotice} onChange={(event) => setAgreedNotice(event.target.value)} placeholder="3 months" />
            </div>
            <div className="field">
              <label htmlFor="tenant-wallet">Tenant wallet address</label>
              <input id="tenant-wallet" type="text" value={tenantWallet} onChange={(event) => setTenantWallet(event.target.value)} placeholder="0x…" spellCheck={false} />
            </div>
            <div className="field">
              <label htmlFor="landlord-wallet">Landlord wallet address</label>
              <input id="landlord-wallet" type="text" value={landlordWallet} onChange={(event) => setLandlordWallet(event.target.value)} placeholder="0x…" spellCheck={false} />
            </div>
          </div>
          {session.mode === "demo" ? (
            <p className="hint">Demo Mode fills in two practice wallets. Switch to Sepolia in the header to use real wallets.</p>
          ) : null}

          {issues.length > 0 ? (
            <Notice tone="warn">
              {issues.map((issue) => issue.message).join(" ")}
            </Notice>
          ) : null}

          {agreementText ? (
            <>
              <DocumentSheet title="Tenancy agreement" text={agreementText} />
              <HashLine hash={hash as string} />
              <div className="button-row">
                <button type="button" className="button ghost" disabled={explainBusy} onClick={explainAgreementNow}>
                  {explainBusy ? "Explaining…" : "Explain it in plain English"}
                </button>
                <button type="button" className="button yellow" onClick={() => setStep("record")}>
                  Continue to record and sign
                </button>
              </div>
              {explainError ? <Notice tone="error">{explainError}</Notice> : null}
              {explain ? (
                <section aria-live="polite" style={{ marginTop: 20 }}>
                  <h3>In plain English</h3>
                  <ul className="explain-list">
                    {explain.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <p className="hint">
                    {explain.provider === "offline" ? "Written from your terms by the built-in explainer." : `Explained by ${explain.provider === "anthropic" ? "Anthropic" : "OpenAI"}. The agreement text above is unchanged.`}
                  </p>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {step === "record" && terms && hash ? (
        <div>
          <h2>Record and sign</h2>
          <p>
            Both parties sign the same fingerprint. The agreement text is not sent to the blockchain, only this
            fingerprint.
          </p>
          <HashLine hash={hash} />

          {record ? (
            <RecordStatus record={record} account={account} busy={chainBusy} onSign={() => void signOnly()} />
          ) : (
            <Notice>This agreement has not been recorded yet.</Notice>
          )}

          {!record || (isParty && !alreadySigned) ? (
            <div className="button-row">
              {!record ? (
                <button type="button" className="button yellow" disabled={chainBusy || !isParty} onClick={() => void registerAndSign()}>
                  {chainBusy ? "Waiting…" : "Record and sign"}
                </button>
              ) : null}
            </div>
          ) : null}
          {!record && !isParty ? (
            <Notice tone="warn">
              {session.mode === "demo"
                ? "Set Acting as to Tenant or Landlord in the header, then record."
                : account
                  ? "The connected wallet is not the tenant or the landlord wallet in this agreement."
                  : "Connect your wallet in the header first."}
            </Notice>
          ) : null}
          {chainError ? <Notice tone="error">{chainError}</Notice> : null}
          {txs.map((tx) => (
            <TxLine key={tx.hash} hash={tx.hash} source={tx.source} />
          ))}

          {record ? (
            <section style={{ marginTop: 24 }}>
              <h3>Send this to the other party</h3>
              <p>
                This link carries the agreement text inside the link itself, so it is not stored on any server. The
                other party opens it, checks the fingerprint, and signs with their own wallet.
                {session.mode === "demo" ? " In Demo Mode the link works only in this browser. Switch Acting as to Landlord to try signing." : ""}
              </p>
              <p className="hash-line">
                <code title={shareUrl}>{shareUrl.length > 60 ? `${shareUrl.slice(0, 56)}…` : shareUrl}</code>
                <CopyButton text={shareUrl} label="Copy link" />
              </p>
              <div className="button-row">
                <button type="button" className="button" onClick={() => setStep("after")}>
                  If the landlord pushes you to leave
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {step === "after" && terms && hash && record ? (
        <div>
          <h2>If the landlord pushes you to leave</h2>
          <p>
            Tell me what happened. CourtAgent writes a calm reply that quotes your signed terms. {terms.state === "Lagos" ? "" : "Check the notice rules of your state with a lawyer first."}
          </p>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="demand-date">Date of the demand</label>
              <input id="demand-date" type="date" value={demandDate} onChange={(event) => setDemandDate(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="letter-date">Date of your letter</label>
              <input id="letter-date" type="date" value={letterDate} onChange={(event) => setLetterDate(event.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="demand-summary">
              What did the landlord say or do? <span className="hint">Finish the sentence: On that date, the landlord…</span>
            </label>
            <textarea
              id="demand-summary"
              value={demandSummary}
              onChange={(event) => setDemandSummary(event.target.value)}
              placeholder="told me to pack out within two weeks and said he will change the lock"
              maxLength={600}
            />
          </div>
          {letter ? (
            <>
              <DocumentSheet title="Reply to landlord" text={letter.letter} />
              <h3 style={{ marginTop: 24 }}>Before you send it</h3>
              <ul className="explain-list">
                {letter.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="hint">The tenancy was for {formatNgn(terms.annualRentNgn)} a year. Keep every receipt.</p>
            </>
          ) : (
            <Notice>Describe what the landlord said or did to see your letter.</Notice>
          )}
        </div>
      ) : null}
    </div>
  );
}

