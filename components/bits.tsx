"use client";

import { useState, type ReactNode } from "react";
import { shortHash } from "@/lib/hash/document";
import { addressUrl, txUrl } from "@/lib/chain/config";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="button ghost small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DocumentSheet({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className="sheet" aria-label={title}>
      <pre className="sheet-text">{text}</pre>
      <div className="sheet-actions">
        <CopyButton text={text} label="Copy text" />
        <button
          type="button"
          className="button ghost small"
          onClick={() => downloadText(`${title.toLowerCase().replace(/\s+/g, "-")}.txt`, text)}
        >
          Download .txt
        </button>
        {children}
      </div>
    </section>
  );
}

export function HashLine({ hash }: { hash: string }) {
  return (
    <p className="hash-line">
      <span>Fingerprint</span>
      <code title={hash}>{shortHash(hash)}</code>
      <CopyButton text={hash} label="Copy full" />
    </p>
  );
}

export function TxLine({ hash, source }: { hash: string; source: "chain" | "demo" }) {
  if (source === "demo") {
    return <p className="tx-line">Demo transaction {shortHash(hash)} (not on a blockchain)</p>;
  }
  return (
    <p className="tx-line">
      Transaction{" "}
      <a href={txUrl(hash)} target="_blank" rel="noreferrer">
        {shortHash(hash)}
      </a>{" "}
      on Ethereum Sepolia
    </p>
  );
}

export function ContractLink({ address }: { address: string }) {
  return (
    <a href={addressUrl(address)} target="_blank" rel="noreferrer">
      {shortHash(address)}
    </a>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  return (
    <p className={`notice ${tone}`} role={tone === "error" ? "alert" : undefined}>
      {children}
    </p>
  );
}

export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (/user rejected|denied/i.test(text)) return "You cancelled the request in your wallet.";
  if (text.includes("CreatorNotAParty")) return "Only one of the parties can record this document. Switch to the tenant or landlord wallet and try again.";
  if (text.includes("AlreadyRegistered")) return "This exact document is already recorded.";
  if (text.includes("NotAParty")) return "The connected account is not one of the parties on this document.";
  if (text.includes("AlreadySigned")) return "This account has already signed.";
  if (text.includes("NotRegistered")) return "This document has not been recorded yet.";
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}
