import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const upstream = new URL("/v1/apis", API_BASE);
  const allowed = ["q", "jurisdiction", "category", "agency", "record_type", "source_id", "limit", "offset"];

  for (const key of allowed) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  try {
    const response = await fetch(upstream, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "The registry API is unavailable." },
      { status: 502 },
    );
  }
}
