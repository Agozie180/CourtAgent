import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "64px 0" }}>
      <h1>Page not found</h1>
      <p>That page does not exist. Check the address, or go back to the start.</p>
      <p>
        <Link href="/">Back to CourtAgent</Link>
      </p>
    </div>
  );
}
