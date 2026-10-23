"use client";

import { lagosDateFromUnix } from "@/lib/domain/dates";
import { useMemo, useState } from "react";
import type { Address } from "viem";
import { saveDocument, type SavedDocument } from "@/lib/storage";
import { useOrigin, useRegistryRecord, useSavedDocuments, useToday } from "@/lib/hooks";
import { buildVerifyPath } from "@/lib/share";
import { hashDocument } from "@/lib/hash/document";
import type { TxResult } from "@/lib/chain/types";
import { DEMO_OWNER, DEMO_WITNESS } from "@/lib/chain/demo";
import { NIGERIAN_STATES, stateLabel, stateMismatchWarning } from "@/lib/domain/jurisdiction";
import { buildWidowLetter, type MarriageType } from "@/lib/domain/letters";
import { buildPropertyRecord, validatePropertyRecord, type PropertyRecordInput } from "@/lib/domain/property";
import { CopyButton, DocumentSheet, HashLine, IssueList, LegalAidList, Notice, StateBanner, TxLine, errorMessage } from "./bits";
import { RecordStatus } from "./record-status";
import { DEMO_ACTORS, useSession } from "./session-provider";

const emptyRecord = (): PropertyRecordInput => ({
  registrantName: "",
  registrantWallet: "",
  propertyDescription: "",
  documentsHeld: "",
  whereKept: "",
  hasWill: false,
  willSummary: "",
  recordDate: "",
  witnessWallet: undefined,
});

export function WidowFlow() {
  const session = useSession();
  const today = useToday();
  const origin = useOrigin();
  const savedDocuments = useSavedDocuments();
  const saved = useMemo(
    () => savedDocuments.filter((doc): doc is Extract<SavedDocument, { kind: "PROPERTY_RECORD" }> => doc.kind === "PROPERTY_RECORD"),
    [savedDocuments],
  );

  // What the user typed. The wallet and the default dates are derived below, so no effect has to copy them in.
  const [draft, setDraft] = useState<PropertyRecordInput>(emptyRecord());
  const registrantWallet = session.mode === "demo" ? DEMO_OWNER : (session.walletAccount ?? "");
  const [needWitness, setNeedWitness] = useState(false);
  const [witnessInput, setWitnessInput] = useState("");
  const witnessWallet = session.mode === "demo" ? witnessInput || DEMO_WITNESS : witnessInput;
  const form = useMemo<PropertyRecordInput>(
    () => ({
      ...draft,
      registrantWallet,
      recordDate: draft.recordDate || today,
      witnessWallet: needWitness ? witnessWallet.trim() : undefined,
    }),
    [draft, registrantWallet, today, needWitness, witnessWallet],
  );
  const [unlockedHash, setUnlockedHash] = useState<string | null>(null);

  const [txs, setTxs] = useState<TxResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // letter
  const [state, setState] = useState("Lagos");
  const [widowName, setWidowName] = useState("");
  const [deceasedName, setDeceasedName] = useState("");
  const [marriageType, setMarriageType] = useState<MarriageType>("unsure");
  const [hasDaughters, setHasDaughters] = useState(false);
  const [addressedTo, setAddressedTo] = useState("");
  const [letterDateInput, setLetterDateInput] = useState("");
  const letterDate = letterDateInput || today;

  const issues = useMemo(() => validatePropertyRecord(form), [form]);
  // The notice follows the state chosen below. If the recorded address names a different state, say so before the notice.
  const stateWarning = stateMismatchWarning(form.propertyDescription, state);
  const text = issues.length === 0 ? buildPropertyRecord(form) : "";
  const hash = text ? hashDocument(text) : null;
  const { record, error: lookupError, refresh: refreshRecord } = useRegistryRecord(session.registry, hash);
  const shownError = error ?? (lookupError ? errorMessage(lookupError) : null);

  const account = session.account;
  const isRegistrant = account !== null && form.registrantWallet.toLowerCase() === account.toLowerCase();
  const isWitness = account !== null && !!form.witnessWallet && form.witnessWallet.toLowerCase() === account.toLowerCase();

  // Only the person registering can edit. In Demo Mode, anyone acting as someone else (a witness, or a stranger) can only read.
  const readOnly = session.mode === "demo" && session.demoActor !== "owner";
  // Once anyone has signed, the record is locked. Editing makes a new, unsigned record.
  const signedAny = record?.signed.some(Boolean) ?? false;
  const locked = signedAny && unlockedHash !== hash;
  const changedAfterSigning = unlockedHash !== null && hash !== unlockedHash;
  function unlockForEditing() {
    setUnlockedHash(hash);
    setTxs([]);
  }

  function update<K extends keyof PropertyRecordInput>(key: K, value: PropertyRecordInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function registerAndSign() {
    if (!hash) return;
    setBusy(true);
    setError(null);
    try {
      const done: TxResult[] = [];
      if (!(await session.registry.getRecord(hash))) {
        done.push(
          await session.registry.register(hash, "PROPERTY_RECORD", [
            form.registrantWallet as Address,
            ...(form.witnessWallet ? [form.witnessWallet as Address] : []),
          ]),
        );
      }
      done.push(await session.registry.sign(hash));
      setTxs((list) => [...list, ...done]);
      saveDocument({
        kind: "PROPERTY_RECORD",
        hash,
        text,
        createdAt: new Date().toISOString(),
        source: session.registry.source,
        record: form,
      });
      refreshRecord();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signAsWitness() {
    if (!hash) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await session.registry.sign(hash);
      setTxs((list) => [...list, tx]);
      refreshRecord();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // A cheap pure template: computed on render, no memo needed.
  const letter =
    record && hash && widowName.trim() && deceasedName.trim() && letterDate
      ? buildWidowLetter({
          state,
          widowName: widowName.trim(),
          deceasedName: deceasedName.trim(),
          propertyDescription: form.propertyDescription.trim(),
          recordHash: hash,
          recordLocation: record.source === "chain" ? "sepolia" : "demo",
          registeredOn: lagosDateFromUnix(record.createdAt),
          marriageType,
          hasWill: form.hasWill,
          hasDaughters,
          addressedTo: addressedTo.trim() || `The family of the late ${deceasedName.trim()}`,
          letterDate,
        })
      : null;

  const shareUrl = text && origin ? `${origin}${buildVerifyPath(text, (record?.source ?? session.registry.source) === "chain" ? "sepolia" : undefined)}` : "";

  return (
    <div>
      {saved.length > 0 ? (
        <div className="field" style={{ marginTop: 24 }}>
          <label htmlFor="saved-record">
            Use a record saved in this browser <span className="hint">This fills in the form below</span>
          </label>
          <select
            id="saved-record"
            defaultValue=""
            disabled={readOnly || locked}
            onChange={(event) => {
              const chosen = saved.find((doc) => doc.hash === event.target.value);
              if (chosen) setDraft({ ...chosen.record });
            }}
          >
            <option value="">Choose a saved record</option>
            {saved.map((doc) => (
              <option key={doc.hash} value={doc.hash}>
                {doc.record.propertyDescription.slice(0, 50)} ({doc.record.recordDate})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <section className="section" style={{ paddingTop: 24 }}>
        <h2>1. Record the property</h2>
        <p>
          Write what the property is and which documents you hold. Only a fingerprint of this record goes on the
          blockchain. Keep the text itself somewhere safe, and give a trusted person a copy.
        </p>
        {readOnly ? (
          <Notice tone="warn">
            You are viewing as {DEMO_ACTORS[session.demoActor].label}. Only the person registering can edit this record, so the form is read-only. Set Acting as to
            Property owner or widow to edit.
          </Notice>
        ) : null}
        {!readOnly && locked ? (
          <Notice tone="warn">
            This record has been signed, so it is locked.{" "}
            <button type="button" className="link-button" onClick={unlockForEditing}>
              Edit anyway
            </button>
          </Notice>
        ) : null}
        {!readOnly && signedAny && !locked && unlockedHash === hash ? (
          <Notice tone="warn">Editing will create a new unsigned record. The signed record stays on the registry and is not deleted.</Notice>
        ) : null}
        {changedAfterSigning ? (
          <Notice tone="warn">You changed a signed record, so this is a new unsigned record. The earlier signed record is unchanged on the registry.</Notice>
        ) : null}
        <fieldset className="bare" disabled={readOnly || locked}>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="registrant">Name of the person registering</label>
            <input id="registrant" type="text" value={form.registrantName} onChange={(event) => update("registrantName", event.target.value)} placeholder="Emeka Okoro" />
          </div>
          <div className="field">
            <label htmlFor="record-date">Date written on the record</label>
            <input id="record-date" type="date" value={form.recordDate} onChange={(event) => update("recordDate", event.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="wallet">
            Wallet address of the person registering{" "}
            <span className="hint">{session.mode === "demo" ? "Demo Mode uses a practice wallet. Set Acting as to Property owner or widow." : "Your connected wallet."}</span>
          </label>
          <input id="wallet" type="text" value={form.registrantWallet} onChange={(event) => update("registrantWallet", event.target.value)} placeholder="0x…" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor="property">Describe the property</label>
          <textarea id="property" value={form.propertyDescription} onChange={(event) => update("propertyDescription", event.target.value)} placeholder="Family house at 4 Bode Street, Surulere, Lagos, on a plot of about 600 square metres" maxLength={500} style={{ minHeight: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="docs">Documents you hold</label>
          <textarea id="docs" value={form.documentsHeld} onChange={(event) => update("documentsHeld", event.target.value)} placeholder="Deed of assignment (2015), survey plan, receipts, marriage certificate" maxLength={500} style={{ minHeight: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="kept">Where the original documents are kept</label>
          <input id="kept" type="text" value={form.whereKept} onChange={(event) => update("whereKept", event.target.value)} placeholder="Fireproof box at home, copies with a lawyer" />
        </div>
        <div className="check-row">
          <span>Has a will been made?</span>
          <div className="yesno" role="group" aria-label="Has a will been made?">
            <button type="button" aria-pressed={form.hasWill} onClick={() => update("hasWill", true)}>Yes</button>
            <button type="button" aria-pressed={!form.hasWill} onClick={() => update("hasWill", false)}>No</button>
          </div>
        </div>
        {form.hasWill ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="will-summary">
              Short summary of the will <span className="hint">Optional. Do not write anything you want kept secret.</span>
            </label>
            <textarea id="will-summary" value={form.willSummary} onChange={(event) => update("willSummary", event.target.value)} maxLength={300} style={{ minHeight: 70 }} />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="signers-w">Who must sign this record?</label>
          <select id="signers-w" value={needWitness ? "two" : "one"} onChange={(event) => setNeedWitness(event.target.value === "two")}>
            <option value="one">Only me (the person registering)</option>
            <option value="two">Me and a witness, lawyer or family member</option>
          </select>
        </div>
        {needWitness ? (
          <div className="field">
            <label htmlFor="witness-w">
              Wallet address of the second signer{" "}
              <span className="hint">{session.mode === "demo" ? "Prefilled with the practice witness. Set Acting as to Witness to sign." : "They sign with their own wallet."}</span>
            </label>
            <input id="witness-w" type="text" value={witnessWallet} onChange={(event) => setWitnessInput(event.target.value)} placeholder="0x…" spellCheck={false} />
          </div>
        ) : null}
        </fieldset>

        <IssueList items={issues} />

        {text ? (
          <>
            <DocumentSheet title="Property record" text={text} />
            <HashLine hash={hash as string} />
            {record ? (
              <RecordStatus record={record} account={account} busy={busy} onSign={isWitness ? () => void signAsWitness() : undefined} />
            ) : (
              <div className="button-row">
                <button type="button" className="button yellow" disabled={busy || !isRegistrant || readOnly} onClick={() => void registerAndSign()}>
                  {busy ? "Waiting…" : "Record and sign"}
                </button>
              </div>
            )}
            {!record && !isRegistrant ? (
              <Notice tone="warn">
                {session.mode === "demo"
                  ? "Set Acting as to Property owner or widow in the header, then record."
                  : account
                    ? "The connected wallet is not the wallet address above."
                    : "Connect your wallet in the header first."}
              </Notice>
            ) : null}
            {shownError ? <Notice tone="error">{shownError}</Notice> : null}
            {txs.map((tx) => (
              <TxLine key={tx.hash} hash={tx.hash} source={tx.source} />
            ))}
            {record ? (
              <p className="hash-line">
                <span>Verify link</span>
                <code title={shareUrl}>{shareUrl.length > 50 ? `${shareUrl.slice(0, 46)}…` : shareUrl}</code>
                <CopyButton text={shareUrl} label="Copy link" />
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="section">
        <h2>2. If relatives come for the property</h2>
        {!record ? (
          <Notice>Record the property above first. The notice cites that record.</Notice>
        ) : (
          <>
            <p>
              This writes a notice you can give to the family. It is not a court order. Please speak to a lawyer, or to a
              legal aid office, as soon as you can.
            </p>
            <fieldset className="bare" disabled={readOnly}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="widow-name">Your name</label>
                <input id="widow-name" type="text" value={widowName} onChange={(event) => setWidowName(event.target.value)} placeholder="Mrs Ngozi Okoro" />
              </div>
              <div className="field">
                <label htmlFor="deceased-name">Name of your late husband</label>
                <input id="deceased-name" type="text" value={deceasedName} onChange={(event) => setDeceasedName(event.target.value)} placeholder="Emeka Okoro" />
              </div>
              <div className="field">
                <label htmlFor="addressed">
                  Who is the notice for? <span className="hint">Optional</span>
                </label>
                <input id="addressed" type="text" value={addressedTo} onChange={(event) => setAddressedTo(event.target.value)} placeholder="The family of the late Mr Emeka Okoro" />
              </div>
              <div className="field">
                <label htmlFor="letter-date-w">Date of the notice</label>
                <input id="letter-date-w" type="date" value={letterDate} onChange={(event) => setLetterDateInput(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="state-w">State where the property is</label>
                <select id="state-w" value={state} onChange={(event) => setState(event.target.value)}>
                  {NIGERIAN_STATES.map((name) => (
                    <option key={name} value={name}>
                      {stateLabel(name)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="marriage">How were you married?</label>
                <select id="marriage" value={marriageType} onChange={(event) => setMarriageType(event.target.value as MarriageType)}>
                  <option value="unsure">I am not sure</option>
                  <option value="statutory">In a registry or church under the Marriage Act (with a marriage certificate)</option>
                  <option value="customary">Under customary law</option>
                </select>
              </div>
            </div>
            <div className="check-row">
              <span>Do you have a daughter?</span>
              <div className="yesno" role="group" aria-label="Do you have a daughter?">
                <button type="button" aria-pressed={hasDaughters} onClick={() => setHasDaughters(true)}>Yes</button>
                <button type="button" aria-pressed={!hasDaughters} onClick={() => setHasDaughters(false)}>No</button>
              </div>
            </div>
            </fieldset>
            <StateBanner state={state} />
            {stateWarning ? <Notice tone="warn">{stateWarning}</Notice> : null}
            {letter ? (
              <>
                <DocumentSheet title="Notice to the family" text={letter.letter} />
                <h3 style={{ marginTop: 24 }}>Before you send it</h3>
                <ul className="explain-list">
                  {letter.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : (
              <Notice>Enter your name and your late husband name to see the notice.</Notice>
            )}
            <LegalAidList state={state} />
          </>
        )}
      </section>
    </div>
  );
}
