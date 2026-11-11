import { NextResponse } from "next/server";
import { getBearerAuthorization, isAllowedDashboardResource } from "../../../../../lib/resource-proxy";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

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
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = getBearerAuthorization(request);
  if (!authorization) return error("AUTH_REQUIRED", "A sign-in session is required.", 401);
  const { resource, id } = await params;
  if (!isAllowedDashboardResource(resource, "PATCH") || !/^[0-9a-f-]{36}$/i.test(id)) {
    return error("RESOURCE_NOT_FOUND", "Unknown or unsupported dashboard resource.", 404);
  }
  const baseUrl = backendBaseUrl();
  if (!baseUrl) return error("API_NOT_CONFIGURED", "Account service is not configured.", 503);

  try {
    const upstream = await fetch(`${baseUrl}/api/v1/${resource}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { authorization, accept: "application/json", "content-type": "application/json" },
      body: await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload: unknown = await upstream.json().catch(() => ({ error: { code: "INVALID_UPSTREAM_RESPONSE", message: "Account service returned an invalid response." } }));
    return NextResponse.json(payload, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("ACCOUNT_SERVICE_UNAVAILABLE", "Account service is temporarily unavailable.", 503);
  }
}
