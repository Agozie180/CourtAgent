"use client";

import { useMemo, useState } from "react";
import { hashDocument } from "@/lib/hash/document";
import { CORPUS, HOME_EXAMPLES, NEUTRAL_ANSWERS } from "@/lib/domain/corpus";
import { runCheck } from "@/lib/domain/risk";

const RECORDED_TEXT = `TENANCY AGREEMENT (DRAFT)

Landlord: Chief A. Bello
Tenant: Ada Okeke

Yearly rent: NGN 1,200,000
Rent paid in advance: 12 months
Notice to quit: 6 months

The landlord will not remove the tenant
or lock the tenant out by force.`;

const RECORDED_HASH = hashDocument(RECORDED_TEXT);

function HashDiff({ recorded, current }: { recorded: string; current: string }) {
  return (
    <code className="hash-diff" aria-label={current}>
      {current.split("").map((char, index) => (
        <span key={index} className={char === recorded[index] ? undefined : "diff"}>
          {char}
        </span>
      ))}
    </code>
  );
}

/** The thesis in five seconds: change one number and the proof no longer matches. Runs fully in the browser. */
export function TamperDemo() {
  const [text, setText] = useState(RECORDED_TEXT);
  const hash = useMemo(() => hashDocument(text), [text]);
  const match = hash === RECORDED_HASH;

  return (
    <div className="tamper">
      <div className="sheet tamper-sheet">
        <label htmlFor="tamper-text" className="tamper-label">
          Sample agreement. Edit anything.
        </label>
        <textarea
          id="tamper-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          rows={11}
          maxLength={2000}
        />
        <div key={match ? "ok" : "bad"} className={`stamp ${match ? "" : "red"}`} aria-hidden="true">
          {match ? "RECORDED" : "NOT RECORDED"}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {match ? "This text matches the recorded fingerprint." : "This text does not match the recorded fingerprint."}
      </p>
      <div className="hash-compare">
        <p>
          <span>On record</span>
          <code>{RECORDED_HASH}</code>
        </p>
        <p>
          <span>This text</span>
          <HashDiff recorded={RECORDED_HASH} current={hash} />
        </p>
      </div>
      <div className="button-row">
        <button type="button" className="button yellow small" onClick={() => setText(RECORDED_TEXT.replace("1,200,000", "1,300,000"))}>
          Change the rent to 1,300,000
        </button>
        <button type="button" className="button ghost small" onClick={() => setText(RECORDED_TEXT)} disabled={match}>
          Put it back
        </button>
      </div>
      <p className="hint">
        A real keccak256 fingerprint, computed in your browser. In the app, the comparison is against the public
        registry instead of this fixed sample.
      </p>
    </div>
  );
}

const LEVEL_CLASS = { Low: "", Medium: "amber", High: "red" } as const;

/** The second unfakeable moment: fixed rules, not an AI, rate a landlord message. Runs fully in the browser. */
export function ScamDemo() {
  const [text, setText] = useState("");
  const result = useMemo(
    () =>
      text.trim()
        ? runCheck({ state: "Lagos", claimedLandlordName: "", documentText: text, advanceMonths: null, answers: NEUTRAL_ANSWERS })
        : null,
    [text],
  );

  return (
    <div className="scam-demo">
      <div className="chip-row" role="group" aria-label="Example messages">
        {HOME_EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className="button ghost small"
            onClick={() => setText(CORPUS.find((item) => item.id === example.id)?.text ?? "")}
          >
            {example.label}
          </button>
        ))}
      </div>
      <label htmlFor="scam-text" className="sr-only">
        A message from a landlord or agent
      </label>
      <textarea
        id="scam-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste what the landlord or agent sent you"
        rows={4}
        maxLength={2000}
      />
      <div role="status" aria-live="polite">
        {result ? (
          <>
            <div className="risk-head">
              <p className={`stamp static ${LEVEL_CLASS[result.level]}`}>{result.level.toUpperCase()} RISK</p>
            </div>
            {result.flags.length > 0 ? (
              <ul className="flag-list">
                {result.flags.slice(0, 4).map((flag) => (
                  <li key={flag.id} className={flag.severity}>
                    {flag.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">
                No warning pattern matched. That does not prove the message is honest. The full check also asks six or seven
                questions about what you have seen and paid.
              </p>
            )}
          </>
        ) : null}
      </div>
      <p className="hint">Fixed rules decide this rating. The AI is not involved, and nothing leaves your browser.</p>
    </div>
  );
}
