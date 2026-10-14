"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { saveDocument, loadDocuments, type SavedDocument } from "@/lib/storage";
import { buildVerifyPath } from "@/lib/share";
import { hashDocument } from "@/lib/hash/document";
import type { RegistryRecord, TxResult } from "@/lib/chain/types";
import { DEMO_OWNER } from "@/lib/chain/demo";
import { NIGERIAN_STATES, stateLabel } from "@/lib/domain/jurisdiction";
import { buildWidowLetter, type MarriageType } from "@/lib/domain/letters";
import { buildPropertyRecord, validatePropertyRecord, type PropertyRecordInput } from "@/lib/domain/property";
import { CopyButton, DocumentSheet, HashLine, Notice, TxLine, errorMessage } from "./bits";
import { RecordStatus } from "./record-status";
import { useSession } from "./session-provider";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyRecord = (): PropertyRecordInput => ({
  registrantName: "",
  registrantWallet: "",
  propertyDescription: "",
  documentsHeld: "",
  whereKept: "",
  hasWill: false,
  willSummary: "",
  recordDate: "",
});

export function WidowFlow() {
  const session = useSession();
  const [form, setForm] = useState<PropertyRecordInput>(emptyRecord());
  const [record, setRecord] = useState<RegistryRecord | null>(null);
  const [txs, setTxs] = useState<TxResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Extract<SavedDocument, { kind: "PROPERTY_RECORD" }>[]>([]);
  const [origin, setOrigin] = useState("");

  // letter
  const [state, setState] = useState("Lagos");
  const [widowName, setWidowName] = useState("");
  const [deceasedName, setDeceasedName] = useState("");
  const [marriageType, setMarriageType] = useState<MarriageType>("unsure");
  const [hasDaughters, setHasDaughters] = useState(false);
  const [addressedTo, setAddressedTo] = useState("");
  const [letterDate, setLetterDate] = useState("");

  const refreshSaved = useCallback(() => {
    setSaved(loadDocuments().filter((doc): doc is Extract<SavedDocument, { kind: "PROPERTY_RECORD" }> => doc.kind === "PROPERTY_RECORD"));
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    setForm((current) => ({ ...current, recordDate: current.recordDate || todayIso() }));
    setLetterDate(todayIso());
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      registrantWallet: session.mode === "demo" ? DEMO_OWNER : (session.walletAccount ?? ""),
    }));
  }, [session.mode, session.walletAccount]);

  const issues = useMemo(() => validatePropertyRecord(form), [form]);
  const text = issues.length === 0 ? buildPropertyRecord(form) : "";
  const hash = text ? hashDocument(text) : null;

  const refreshRecord = useCallback(async () => {
    if (!hash) {
      setRecord(null);
      return;
    }
    try {
      setRecord(await session.registry.getRecord(hash));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [hash, session.registry]);

  useEffect(() => {
    void refreshRecord();
  }, [refreshRecord]);

  const account = session.account;
  const isRegistrant = account !== null && form.registrantWallet.toLowerCase() === account.toLowerCase();

  function update<K extends keyof PropertyRecordInput>(key: K, value: PropertyRecordInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function registerAndSign() {
    if (!hash) return;
    setBusy(true);
    setError(null);
    try {
      const done: TxResult[] = [];
      if (!(await session.registry.getRecord(hash))) {
        done.push(await session.registry.register(hash, "PROPERTY_RECORD", [form.registrantWallet as Address]));
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
      refreshSaved();
      await refreshRecord();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const letter = useMemo(() => {
    if (!record || !hash || !widowName.trim() || !deceasedName.trim() || !letterDate) return null;
    return buildWidowLetter({
      state,
      widowName: widowName.trim(),
      deceasedName: deceasedName.trim(),
      propertyDescription: form.propertyDescription.trim(),
      recordHash: hash,
      recordLocation: record.source === "chain" ? "sepolia" : "demo",
      recordDate: form.recordDate,
      marriageType,
      hasWill: form.hasWill,
      hasDaughters,
      addressedTo: addressedTo.trim() || `The family of the late ${deceasedName.trim()}`,
      letterDate,
    });
  }, [record, hash, state, widowName, deceasedName, form, marriageType, hasDaughters, addressedTo, letterDate]);

  const shareUrl = text && origin ? `${origin}${buildVerifyPath(text)}` : "";

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
            onChange={(event) => {
              const chosen = saved.find((doc) => doc.hash === event.target.value);
              if (chosen) setForm({ ...chosen.record, registrantWallet: form.registrantWallet });
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
        <div className="field-grid">
          <div className="field">
            <label htmlFor="registrant">Name of the person registering</label>
            <input id="registrant" type="text" value={form.registrantName} onChange={(event) => update("registrantName", event.target.value)} placeholder="Emeka Okoro" />
          </div>
          <div className="field">
            <label htmlFor="record-date">Date of the record</label>
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

        {issues.length > 0 ? <Notice tone="warn">{issues.join(" ")}</Notice> : null}

        {text ? (
          <>
            <DocumentSheet title="Property record" text={text} />
            <HashLine hash={hash as string} />
            {record ? (
              <RecordStatus record={record} account={account} busy={busy} />
            ) : (
              <div className="button-row">
                <button type="button" className="button yellow" disabled={busy || !isRegistrant} onClick={() => void registerAndSign()}>
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
            {error ? <Notice tone="error">{error}</Notice> : null}
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
                <input id="letter-date-w" type="date" value={letterDate} onChange={(event) => setLetterDate(event.target.value)} />
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
          </>
        )}
      </section>
    </div>
  );
}
