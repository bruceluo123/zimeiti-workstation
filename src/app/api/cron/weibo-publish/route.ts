import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, cronAuthorized } from "@/lib/automation/secret";
import { publishDueWeiboDrafts } from "@/lib/weibo/publish-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const results = await publishDueWeiboDrafts(automationSecret());
    return NextResponse.json({ processed: results.length, results });
  } catch {
    return NextResponse.json({ error: "Unable to process publish queue" }, { status: 503 });
  }
}
