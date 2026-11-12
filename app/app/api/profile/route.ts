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

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length <= 7) {
    return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "A sign-in session is required." } }, { status: 401 });
  }
  const baseUrl = backendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: { code: "API_NOT_CONFIGURED", message: "Account service is not configured." } }, { status: 503 });
  }

  try {
    const upstream = await fetch(`${baseUrl}/api/v1/user_profiles?limit=1`, {
      headers: { authorization, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await upstream.json().catch(() => ({ error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Account service returned an invalid response." } }));
    return NextResponse.json(payload, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: { code: "ACCOUNT_SERVICE_UNAVAILABLE", message: "Account service is temporarily unavailable." } }, { status: 503 });
  }
}
