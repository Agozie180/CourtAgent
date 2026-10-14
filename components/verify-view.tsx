"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { hashDocument, isDocHash, shortHash } from "@/lib/hash/document";
import { comparePartiesToText } from "@/lib/hash/parties";
import { readShareFromHash } from "@/lib/share";
import { loadDocuments, type SavedDocument } from "@/lib/storage";
import type { RegistryRecord, TxResult } from "@/lib/chain/types";
import { HashLine, Notice, TxLine, errorMessage } from "./bits";
import { RecordStatus, formatTime } from "./record-status";
import { useSession } from "./session-provider";

export function VerifyView() {
  const session = useSession();
  const [text, setText] = useState("");
  const [typedHash, setTypedHash] = useState("");
  const [fromLink, setFromLink] = useState(false);
  const [record, setRecord] = useState<RegistryRecord | null>(null);
  const [looked, setLooked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxResult | null>(null);
  const [saved, setSaved] = useState<SavedDocument[]>([]);

  useEffect(() => {
    const read = () => {
      const shared = readShareFromHash(window.location.hash);
      if (shared) {
        setText(shared);
        setFromLink(true);
      }
    };
    read();
    setSaved(loadDocuments());
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const hash = useMemo<Hex | null>(() => {
    if (text.trim()) return hashDocument(text);
    return isDocHash(typedHash) ? (typedHash.trim() as Hex) : null;
  }, [text, typedHash]);

  const partyCheck = useMemo(
    () => (record && text.trim() ? comparePartiesToText(text, record.parties) : null),
    [record, text],
  );

  const lookup = useCallback(async () => {
    if (!hash) {
      setRecord(null);
      setLooked(false);
      return;
    }
    try {
      setError(null);
      setRecord(await session.registry.getRecord(hash));
      setLooked(true);
    } catch (err) {
      setError(errorMessage(err));
      setRecord(null);
      setLooked(false);
    }
  }, [hash, session.registry]);

  useEffect(() => {
    void lookup();
  }, [lookup]);

  async function sign() {
    if (!hash) return;
    setBusy(true);
    setError(null);
    try {
      setTx(await session.registry.sign(hash));
      await lookup();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const where =
    session.mode === "demo"
      ? "Demo Mode records kept in this browser"
      : "the CourtAgent registry on Ethereum Sepolia";

  return (
    <div>
      <p className="hint">Checking {where}. Change this with the Demo and Sepolia buttons in the header.</p>

      {fromLink ? (
        <Notice tone="ok">
          This text came from the link you opened. It was not sent to any server. Try changing one word below to see the
          fingerprint change.
        </Notice>
      ) : null}

      <div className="field">
        <label htmlFor="verify-text">The exact text of the document</label>
        <textarea
          id="verify-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setTx(null);
          }}
          style={{ minHeight: 220, fontFamily: "var(--font-doc)" }}
          maxLength={20000}
          placeholder="Paste the agreement or record here"
        />
      </div>

      {!text.trim() ? (
        <div className="field">
          <label htmlFor="verify-hash">
            Or look up a fingerprint <span className="hint">66 characters starting with 0x</span>
          </label>
          <input id="verify-hash" type="text" value={typedHash} onChange={(event) => setTypedHash(event.target.value.trim())} placeholder="0x…" spellCheck={false} />
          {typedHash && !isDocHash(typedHash) ? <p className="hint">That is not a valid fingerprint yet.</p> : null}
        </div>
      ) : null}

      {hash ? <HashLine hash={hash} /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {hash && looked && record ? (
        <>
          {partyCheck?.status === "mismatch" ? (
            <Notice tone="error">
              Warning: this exact text was recorded, but the wallets recorded for it are not the wallets written in the
              text. Someone other than the named parties may have recorded it. Do not rely on this record.
            </Notice>
          ) : (
            <Notice tone="ok">
              {text.trim()
                ? "This exact text matches a recorded document."
                : "This fingerprint is recorded. Paste the text to confirm it matches."}
              {partyCheck?.status === "match" ? " The recorded wallets are exactly the wallets named in the text." : ""}
            </Notice>
          )}
          <RecordStatus record={record} account={session.account} busy={busy} onSign={() => void sign()} />
          {tx ? <TxLine hash={tx.hash} source={tx.source} /> : null}
        </>
      ) : null}

      {hash && looked && !record ? (
        <div className="status-box bad">
          <p className="stamp static red">NOT RECORDED</p>
          <p>
            No record exists for this {text.trim() ? "exact text" : "fingerprint"} in {where}. If you expected one, the
            text may have been changed. Even a single word, number or extra space inside a line gives a different
            fingerprint. It may also have been recorded on another network or in another browser.
          </p>
        </div>
      ) : null}

      {saved.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <h2>Saved in this browser</h2>
          <table className="plain-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Saved</th>
                <th>Fingerprint</th>
                <th>
                  <span style={{ position: "absolute", left: -9999 }}>Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {saved.map((doc) => (
                <tr key={doc.hash}>
                  <td>{doc.kind === "PROPERTY_RECORD" ? "Property record" : "Tenancy agreement"}</td>
                  <td>{formatTime(Math.floor(new Date(doc.createdAt).getTime() / 1000))}</td>
                  <td>
                    <code>{shortHash(doc.hash)}</code>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => {
                        setText(doc.text);
                        setFromLink(false);
                        setTx(null);
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
