// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScamDemo, TamperDemo } from "./home-demos";
import { RecordStatus } from "./record-status";

afterEach(cleanup);

describe("home page: tamper test (the thesis a judge sees first)", () => {
  it("starts as RECORDED, flips to NOT RECORDED when one number changes, and flips back", () => {
    const { container } = render(<TamperDemo />);
    expect(screen.getByText("RECORDED")).toBeTruthy();
    expect(container.querySelectorAll(".hash-diff .diff").length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /1,300,000/ }));
    expect(screen.getByText("NOT RECORDED")).toBeTruthy();
    // a one-number edit changes almost every character of the fingerprint
    expect(container.querySelectorAll(".hash-diff .diff").length).toBeGreaterThan(40);

    fireEvent.click(screen.getByRole("button", { name: /put it back/i }));
    expect(screen.getByText("RECORDED")).toBeTruthy();
  });

  it("flips when a visitor types their own one-word edit", () => {
    render(<TamperDemo />);
    const box = screen.getByLabelText(/sample agreement/i) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: box.value.replace("6 months", "1 month") } });
    expect(screen.getByText("NOT RECORDED")).toBeTruthy();
  });

  it("ignores harmless trailing spaces, as the real fingerprint does", () => {
    render(<TamperDemo />);
    const box = screen.getByLabelText(/sample agreement/i) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: `${box.value}   \n\n` } });
    expect(screen.getByText("RECORDED")).toBeTruthy();
  });
});

describe("home page: scam check", () => {
  it("rates a scam example High with reasons and an honest message Low", () => {
    render(<ScamDemo />);
    fireEvent.click(screen.getByRole("button", { name: /abroad, keys by courier/i }));
    expect(screen.getByText("HIGH RISK")).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /honest message/i }));
    expect(screen.getByText("LOW RISK")).toBeTruthy();
    expect(screen.getByText(/does not prove the message is honest/i)).toBeTruthy();
  });

  it("shows nothing until there is text", () => {
    render(<ScamDemo />);
    expect(screen.queryByText(/RISK/)).toBeNull();
  });
});

describe("record status: the registry refuses a stranger", () => {
  const record = {
    docHash: "0x" + "ab".repeat(32),
    creator: "0x0000000000000000000000000000000000007e01",
    createdAt: 1_700_000_000,
    fullySignedAt: 0,
    kind: "TENANCY_AGREEMENT" as const,
    parties: ["0x0000000000000000000000000000000000007e01", "0x000000000000000000000000000000000001a2d1"],
    signed: [true, false],
    source: "demo" as const,
  };

  it("offers 'Try to sign anyway' to an account that is not a party", () => {
    const onSign = vi.fn();
    render(<RecordStatus record={record as never} account="0x0000000000000000000000000000000000000abc" onSign={onSign} />);
    fireEvent.click(screen.getByRole("button", { name: /try to sign anyway/i }));
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it("offers the normal Sign button to a party who has not signed, and nothing to one who has", () => {
    const { rerender } = render(<RecordStatus record={record as never} account="0x000000000000000000000000000000000001a2d1" onSign={() => {}} />);
    expect(screen.getByRole("button", { name: /sign this document/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /try to sign anyway/i })).toBeNull();
    rerender(<RecordStatus record={record as never} account="0x0000000000000000000000000000000000007e01" onSign={() => {}} />);
    expect(screen.queryByRole("button", { name: /sign this document/i })).toBeNull();
  });
});
