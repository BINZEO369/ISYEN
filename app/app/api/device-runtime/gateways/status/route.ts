import { getBearerAuthorization } from "../../../../../lib/resource-proxy";

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

function error(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const authorization = getBearerAuthorization(request);
  if (!authorization) return error("AUTH_REQUIRED", "A sign-in session is required.", 401);
  const baseUrl = backendBaseUrl();
  if (!baseUrl) return error("API_NOT_CONFIGURED", "Account service is not configured.", 503);
  const incoming = new URL(request.url);
  const upstreamUrl = new URL(`${baseUrl}/api/v1/device-runtime/gateways/status`);
  for (const key of ["limit", "offset"]) {
    const value = incoming.searchParams.get(key);
    if (value) upstreamUrl.searchParams.set(key, value);
  }
  try {
    const upstream = await fetch(upstreamUrl, { headers: { authorization, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const payload: unknown = await upstream.json().catch(() => ({ error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Account service returned an invalid response." } }));
    return Response.json(payload, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("ACCOUNT_SERVICE_UNAVAILABLE", "Account service is temporarily unavailable.", 503);
  }
}
