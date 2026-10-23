"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Hex } from "viem";
import { hashDocument, hashProblem, isDocHash, shortHash } from "@/lib/hash/document";
import { comparePartiesToText } from "@/lib/hash/parties";
import { readShareFromHash, readShareNetwork } from "@/lib/share";
import { useRegistryRecord, useSavedDocuments } from "@/lib/hooks";
import type { TxResult } from "@/lib/chain/types";
import { HashLine, Notice, TxLine, errorMessage } from "./bits";
import { RecordStatus, formatTime } from "./record-status";
import { useSession } from "./session-provider";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;

export function VerifyView() {
  const session = useSession();
  // Text from a share link (/verify#d=...). The fragment never leaves the browser.
  const fragment = useSyncExternalStore(subscribeHash, readHash, () => "");
  const linkedText = readShareFromHash(fragment);
  // A link made for Sepolia must be read against Sepolia, not against this browser's own Demo Mode records.
  const linkedNetwork = readShareNetwork(fragment);
  // Text the visitor typed or opened. It wins over the link, and `null` means "still showing the link's text".
  const [edited, setEdited] = useState<string | null>(null);
  const [typedHash, setTypedHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxResult | null>(null);
  const saved = useSavedDocuments();

  const text = edited ?? linkedText ?? "";
  const fromLink = edited === null && linkedText !== null;

  // A typed fingerprint is checked for its shape (0x and 64 hex characters) before any lookup is made.
  const typedProblem = hashProblem(typedHash);
  const hash = useMemo<Hex | null>(() => {
    if (text.trim()) return hashDocument(text);
    return isDocHash(typedHash) ? (typedHash.trim() as Hex) : null;
  }, [text, typedHash]);

  const { record, looked, error: lookupError, refresh } = useRegistryRecord(session.registry, hash);

  const partyCheck = useMemo(
    () => (record && text.trim() ? comparePartiesToText(text, record.parties) : null),
    [record, text],
  );

  async function sign() {
    if (!hash) return;
    setBusy(true);
    setError(null);
    try {
      setTx(await session.registry.sign(hash));
      refresh();
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

      {linkedNetwork === "sepolia" && session.mode !== "wallet" ? (
        <Notice tone="warn">
          This link was made for the registry on Ethereum Sepolia, but you are looking at Demo Mode records, which exist only in this
          browser. A real record will show as not recorded here.{" "}
          {session.chainConfigured ? (
            <button type="button" className="link-button" onClick={() => session.setMode("wallet")}>
              Switch to Sepolia
            </button>
          ) : (
            "No Sepolia registry is configured on this site."
          )}
        </Notice>
      ) : null}

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
            setEdited(event.target.value);
            setTx(null);
          }}
          style={{ minHeight: 220, fontFamily: "var(--font-doc)" }}
          maxLength={20000}
          placeholder="Paste the agreement or record here"
        />
      </div>

      {!text.trim() && !typedHash ? <Notice tone="info">Paste the document text to check it.</Notice> : null}

      {!text.trim() ? (
        <div className="field">
          <label htmlFor="verify-hash">
            Or look up a fingerprint <span className="hint">66 characters starting with 0x</span>
          </label>
          <input
            id="verify-hash"
            type="text"
            value={typedHash}
            onChange={(event) => setTypedHash(event.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
            aria-invalid={typedProblem ? true : undefined}
            aria-describedby={typedProblem ? "verify-hash-error" : undefined}
          />
          {typedProblem ? (
            <p id="verify-hash-error" className="notice error" role="alert">
              {typedProblem} Nothing was looked up.
            </p>
          ) : null}
        </div>
      ) : null}

      {hash ? <HashLine hash={hash} /> : null}
      {error || lookupError ? <Notice tone="error">{error ?? errorMessage(lookupError)}</Notice> : null}

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
          {session.mode === "wallet" && !session.account && record.signed.some((done) => !done) ? (
            <Notice tone="info">To sign, connect the wallet that is named as a party, using the button in the header.</Notice>
          ) : null}
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
                        setEdited(doc.text);
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
