import { NextResponse } from "next/server";
import { ingestNews } from "@/lib/news/ingest";
import { adminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds; fetching ~11 feeds takes well under this

// Vercel Cron calls this daily with "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await ingestNews(adminClient());
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
