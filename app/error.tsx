"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap" style={{ padding: "64px 0" }}>
      <h1>Something went wrong</h1>
      <p>Nothing you typed has been lost from your browser. Try again.</p>
      <p>
        <button type="button" className="button" onClick={reset}>
          Try again
        </button>
      </p>
    </div>
  );
}
