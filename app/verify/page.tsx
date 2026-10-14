import type { Metadata } from "next";
import { VerifyView } from "@/components/verify-view";

export const metadata: Metadata = { title: "Verify a document | CourtAgent" };

export default function VerifyPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Verify a document</h1>
        <p>
          Paste the exact text of an agreement or record. CourtAgent computes its fingerprint and checks whether it was
          recorded, when, and who has signed.
        </p>
      </div>
      <VerifyView />
    </div>
  );
}
