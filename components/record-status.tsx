"use client";

import type { Address } from "viem";
import { getAddress } from "viem";
import { shortHash } from "@/lib/hash/document";
import type { RegistryRecord } from "@/lib/chain/types";

export function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export function RecordStatus({
  record,
  account,
  busy,
  onSign,
}: {
  record: RegistryRecord;
  account: Address | null;
  busy?: boolean;
  onSign?: () => void;
}) {
  const fully = record.fullySignedAt > 0;
  const myIndex = account ? record.parties.findIndex((party) => getAddress(party) === getAddress(account)) : -1;
  const canSign = myIndex >= 0 && !record.signed[myIndex];

  return (
    <div className={`status-box ${fully ? "good" : ""}`}>
      <p className={`stamp static ${fully ? "" : "amber"}`}>{fully ? "FULLY SIGNED" : "WAITING FOR SIGNATURES"}</p>
      <p>
        Recorded {formatTime(record.createdAt)} as {record.kind === "PROPERTY_RECORD" ? "a property record" : "a tenancy agreement"}
        {record.source === "demo" ? " in Demo Mode (not on a blockchain)." : " on Ethereum Sepolia."}
        {fully ? ` Fully signed ${formatTime(record.fullySignedAt)}.` : ""}
      </p>
      <ul className="party-list">
        {record.parties.map((party, index) => (
          <li key={party}>
            <span className={record.signed[index] ? "tick" : "pending"}>{record.signed[index] ? "Signed" : "Not signed yet"}</span>
            <code title={party}>{shortHash(party)}</code>
            {account && getAddress(party) === getAddress(account) ? <span>(you)</span> : null}
          </li>
        ))}
      </ul>
      {onSign && canSign ? (
        <button type="button" className="button yellow" disabled={busy} onClick={onSign}>
          {busy ? "Signing…" : "Sign this document"}
        </button>
      ) : null}
    </div>
  );
}
