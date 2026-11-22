import { NextResponse } from "next/server";

const API_BASE = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/v1/connectors`, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "The registry API is unavailable." }, { status: 502 });
  }
}
