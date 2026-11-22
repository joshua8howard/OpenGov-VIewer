import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const document = String(form.get("document") ?? "");
  let payload: { apis?: unknown[]; datasets?: unknown[] };
  try {
    payload = JSON.parse(document);
  } catch {
    return NextResponse.redirect(new URL("/manage?error=invalid-json", request.url));
  }

  const baseUrl = process.env.GOVAPI_API_URL ?? "http://127.0.0.1:8000";
  if (Array.isArray(payload.apis)) {
    await fetch(`${baseUrl}/v1/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ records: payload.apis }),
      cache: "no-store",
    });
  }

  if (Array.isArray(payload.datasets)) {
    for (const dataset of payload.datasets) {
      await fetch(`${baseUrl}/v1/datasets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dataset),
        cache: "no-store",
      });
    }
  }

  return NextResponse.redirect(new URL("/manage?imported=true", request.url));
}
