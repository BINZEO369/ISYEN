export const dashboardReadableResources = new Set([
  "homes",
  "rooms",
  "devices",
  "device_states",
  "gateways",
  "scenes",
  "automations",
]);

const supportedQueryParameters = ["limit", "offset", "order_by", "order", "home_id", "room_id", "device_id", "gateway_id", "status"] as const;

export function isAllowedDashboardResource(resource: string, method: "GET" | "POST" | "PATCH"): boolean {
  if (method === "GET") return dashboardReadableResources.has(resource);
  if (method === "POST") return resource === "homes" || resource === "devices";
  return method === "PATCH" && resource === "devices";
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
