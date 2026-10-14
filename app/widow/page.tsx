import type { Metadata } from "next";
import { WidowFlow } from "@/components/widow-flow";

export const metadata: Metadata = { title: "Protect a family home | CourtAgent" };

export default function WidowPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Protect a family home</h1>
        <p>
          Make a dated record of the home and its documents while the family is together. If relatives later try to take
          it, write a calm notice that cites that record and the court rulings that protect a widow.
        </p>
      </div>
      <WidowFlow />
    </div>
  );
}
