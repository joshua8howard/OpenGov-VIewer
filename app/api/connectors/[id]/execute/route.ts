import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const response = await fetch(
      `${API_BASE}/v1/connectors/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: await request.text(),
        cache: "no-store",
      },
    );
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "The registry API is unavailable." }, { status: 502 });
  }
}
