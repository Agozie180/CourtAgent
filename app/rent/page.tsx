import type { Metadata } from "next";
import { RentFlow } from "@/components/rent-flow";

export const metadata: Metadata = { title: "Rent a home | CourtAgent" };

export default function RentPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Rent a home</h1>
        <p>Answer a few questions, check the landlord, then sign an agreement that is recorded so it cannot be quietly changed.</p>
      </div>
      <RentFlow />
    </div>
  );
}
