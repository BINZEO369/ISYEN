export const dashboardReadableResources = new Set([
  "homes",
  "rooms",
  "devices",
  "gateways",
  "scenes",
  "automations",
]);

const supportedQueryParameters = ["limit", "offset", "order_by", "order", "home_id", "status"] as const;

export function isAllowedDashboardResource(resource: string, method: "GET" | "POST"): boolean {
  return dashboardReadableResources.has(resource) && (method === "GET" || resource === "homes");
}

export function getBearerAuthorization(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token ? `Bearer ${token}` : null;
}

export function forwardedDashboardQuery(searchParams: URLSearchParams): URLSearchParams {
  const forwarded = new URLSearchParams();
  for (const key of supportedQueryParameters) {
    const value = searchParams.get(key);
    if (value) forwarded.set(key, value);
  }
  return forwarded;
}
