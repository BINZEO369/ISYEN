import { NextResponse } from "next/server";

export const runtime = "nodejs";

function backendBaseUrl(): string | null {
  const configured = process.env.ISYEN_API_BASE_URL?.trim();
  const value = configured || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:4000" : "");
  if (!value) return null;
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const baseUrl = backendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: { code: "API_NOT_CONFIGURED", message: "Account service is not configured." } }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await upstream.json().catch(() => ({ error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Account service returned an invalid response." } }));
    return NextResponse.json(payload, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "ACCOUNT_SERVICE_UNAVAILABLE", message: "Account service is temporarily unavailable." } }, { status: 503 });
  }
}
