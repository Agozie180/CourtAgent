"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO_ACTORS, useSession, type DemoActor } from "./session-provider";
import { shortHash } from "@/lib/hash/document";

const links = [
  { href: "/rent", label: "Rent a home" },
  { href: "/widow", label: "Protect a home" },
  { href: "/verify", label: "Verify a document" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const session = useSession();

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" className="wordmark" aria-label="CourtAgent home">
          <span className="wordmark-mark" aria-hidden="true">C</span>
          CourtAgent
        </Link>
        <nav aria-label="Main" className="main-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mode-box">
          <div className="mode-toggle" role="group" aria-label="Where records are saved">
            <button type="button" aria-pressed={session.mode === "demo"} onClick={() => session.setMode("demo")}>
              Demo
            </button>
            <button
              type="button"
              aria-pressed={session.mode === "wallet"}
              disabled={!session.chainConfigured}
              title={session.chainConfigured ? undefined : "Set NEXT_PUBLIC_REGISTRY_ADDRESS to turn this on"}
              onClick={() => session.setMode("wallet")}
            >
              Sepolia
            </button>
          </div>
          {session.mode === "demo" ? (
            <label className="actor-pick">
              <span>Acting as</span>
              <select
                value={session.demoActor}
                onChange={(event) => session.setDemoActor(event.target.value as DemoActor)}
              >
                {session.actors.map((key) => (
                  <option key={key} value={key}>
                    {DEMO_ACTORS[key].label}
                  </option>
                ))}
              </select>
            </label>
          ) : session.walletAccount ? (
            <span className="wallet-line">{shortHash(session.walletAccount)}</span>
          ) : (
            <button type="button" className="button small" onClick={() => void session.connectWallet()}>
              Connect wallet
            </button>
          )}
        </div>
      </div>
      {session.mode === "demo" ? (
        <p className="mode-note wrap">
          Demo mode: records are kept in this browser only and are not on any blockchain.
        </p>
      ) : null}
      {session.walletError ? (
        <p className="mode-note error wrap" role="alert">
          {session.walletError}
        </p>
      ) : null}
    </header>
  );
}
