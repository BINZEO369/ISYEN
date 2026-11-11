export type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  profile_photo: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone_number: string | null;
  bio: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  latitude: number | null;
  longitude: number | null;
  language: string;
  currency: string;
  timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
  temperature_unit: "celsius" | "fahrenheit";
  theme: "light" | "dark" | "system";
  push_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  security_alerts: boolean;
  device_alerts: boolean;
  automation_alerts: boolean;
  profile_status: string;
  profile_completion: number;
  created_at: string;
  updated_at: string;
};

export type Home = {
  id: string;
  name: string;
  description: string | null;
  address: Record<string, unknown>;
  timezone: string;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
};

export type Room = { id: string; home_id: string; name: string; room_type: string | null };
export type Device = { id: string; home_id: string; room_id: string | null; name: string; status: string; device_type_id: string };
export type Gateway = { id: string; home_id: string; name: string; gateway_type: string; status: string; last_seen_at: string | null };
export type Scene = { id: string; home_id: string; name: string; description: string | null; icon: string | null; is_enabled: boolean };
export type Automation = { id: string; home_id: string; name: string; description: string | null; is_enabled: boolean };

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function requestJson<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) {
    throw new ApiRequestError(payload?.error?.message ?? "তথ্য আনা যায়নি। আবার চেষ্টা করুন।", response.status);
  }
  return payload?.data as T;
}

export async function loadProfile(accessToken: string): Promise<Profile> {
  const rows = await requestJson<Profile[]>("/api/profile", accessToken);
  if (!rows?.[0]) throw new Error("আপনার অ্যাকাউন্টের তথ্য পাওয়া যায়নি।");
  return rows[0];
}

export async function loadResource<T>(resource: string, accessToken: string): Promise<T[]> {
  const rows = await requestJson<T[]>(`/api/resources/${resource}?limit=100&order=desc`, accessToken);
  return rows ?? [];
}

export async function createHome(input: { name: string; timezone: string; address: Record<string, unknown> }, accessToken: string): Promise<Home> {
  return requestJson<Home>("/api/resources/homes", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
