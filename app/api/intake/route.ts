import { NextResponse } from "next/server";
import { runIntake } from "@/lib/ai/tasks";
import { badRequest, rateLimited, readJson, tooMany } from "@/lib/api/guard";
import { INTAKE_ORDER, emptyIntake, mergeFields, sanitizeFields, type IntakeKey } from "@/lib/domain/intake";

export async function POST(request: Request) {
  if (rateLimited(request)) return tooMany();
  const body = (await readJson(request)) as { message?: unknown; fields?: unknown; expected?: unknown } | null;
  if (!body || typeof body.message !== "string" || body.message.trim().length === 0 || body.message.length > 1000) {
    return badRequest("Send a short message.");
  }
  const expected =
    typeof body.expected === "string" && (INTAKE_ORDER as string[]).includes(body.expected)
      ? (body.expected as IntakeKey)
      : null;
  const current = mergeFields(emptyIntake(), sanitizeFields(body.fields));
  const result = await runIntake(body.message, current, expected);
  return NextResponse.json(result);
}
