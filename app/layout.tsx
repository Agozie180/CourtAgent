import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";
import { DISCLAIMER } from "@/lib/domain/lagos-tenancy";

export const metadata: Metadata = {
  title: "CourtAgent | Check the landlord. Sign the agreement. Keep the proof.",
  description:
    "CourtAgent helps Nigerian tenants spot fake listings, draft a clear tenancy agreement and record its fingerprint on Ethereum Sepolia, and helps widows keep a dated record of the family home.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <footer className="site-footer">
            <div className="wrap">
              <p>{DISCLAIMER}</p>
              <p>
                In Sepolia mode only a fingerprint (hash) of each document is recorded on Ethereum Sepolia, a test
                network. In Demo Mode nothing leaves your browser. The document text stays in your browser or in the
                link you share.
              </p>
              <p>
                <Link href="/verify">Verify a document</Link>
              </p>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
