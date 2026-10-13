import { NextResponse } from "next/server";
import { runDocumentCheck } from "@/lib/ai/tasks";
import { badRequest, rateLimited, readJson, tooMany } from "@/lib/api/guard";
import type { CheckInput } from "@/lib/domain/risk";
import { isNigerianState } from "@/lib/domain/jurisdiction";

const ANSWER_KEYS = [
  "inspectedInPerson",
  "sawOriginalTitle",
  "dealingWithAgent",
  "agentHasAuthorityLetter",
  "askedToPayBeforeViewing",
  "paymentToPersonalAccount",
  "receiptPromised",
] as const;

export async function POST(request: Request) {
  if (rateLimited(request)) return tooMany();
  const body = (await readJson(request, 60_000)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid request.");

  const name = typeof body.claimedLandlordName === "string" ? body.claimedLandlordName.trim().slice(0, 80) : "";
  const text = typeof body.documentText === "string" ? body.documentText.slice(0, 8000) : "";
  const advance =
    typeof body.advanceMonths === "number" && Number.isFinite(body.advanceMonths) && body.advanceMonths > 0 && body.advanceMonths <= 120
      ? Math.round(body.advanceMonths)
      : null;
  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers = {} as CheckInput["answers"];
  for (const key of ANSWER_KEYS) {
    if (typeof rawAnswers[key] !== "boolean") return badRequest(`Answer "${key}" must be yes or no.`);
    answers[key] = rawAnswers[key] as boolean;
  }
  if (!name) return badRequest("Enter the landlord's name.");
  if (!isNigerianState(body.state)) return badRequest("Choose the state the property is in.");

  const outcome = await runDocumentCheck({ state: body.state, claimedLandlordName: name, documentText: text, advanceMonths: advance, answers });
  return NextResponse.json(outcome);
}
