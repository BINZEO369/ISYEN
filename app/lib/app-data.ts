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
export type Device = {
  id: string;
  home_id: string;
  room_id: string | null;
  name: string;
  status: string;
  device_type_id: string;
  config: Record<string, unknown>;
  last_seen_at: string | null;
};
export type DeviceState = { id: string; device_id: string; state: Record<string, unknown>; reported_at: string; received_at: string; source: string };
export type SensorReading = { id: string; home_id: string; device_id: string; metric: string; value_numeric: number | null; value_text: string | null; unit: string | null; recorded_at: string };
export const ESP32_S3_OUTPUT_GPIO_PINS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47, 48] as const;
export const ESP32_S3_DIGITAL_INPUT_GPIO_PINS = [1, 2, ...ESP32_S3_OUTPUT_GPIO_PINS] as const;
export const ESP32_S3_ANALOG_INPUT_GPIO_PINS = [1, 2, 4, 5, 6, 7, 8, 9, 10] as const;
export type Gateway = { id: string; home_id: string; name: string; gateway_type: string; status: string; last_seen_at: string | null };
export type Scene = { id: string; home_id: string; name: string; description: string | null; icon: string | null; is_enabled: boolean };
export type Automation = { id: string; home_id: string; name: string; description: string | null; is_enabled: boolean };

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
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

export async function loadDeviceIdentity(accessToken: string): Promise<{ isyen_id: string }> {
  return requestJson<{ isyen_id: string }>("/api/device-runtime/identity", accessToken);
}

export async function loadLatestSensorReadings(homeId: string, accessToken: string): Promise<SensorReading[]> {
  const query = new URLSearchParams({ home_id: homeId });
  return requestJson<SensorReading[]>(`/api/device-runtime/sensors/latest?${query.toString()}`, accessToken);
}

export async function loadResource<T>(resource: string, accessToken: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset <= 1_000_000; offset += 100) {
    const page = await requestJson<T[]>(`/api/resources/${resource}?limit=100&offset=${offset}&order=desc`, accessToken);
    rows.push(...(page ?? []));
    if (!page || page.length < 100) break;
  }
  return rows;
}

export async function createHome(input: { name: string; timezone: string; address: Record<string, unknown> }, accessToken: string): Promise<Home> {
  return requestJson<Home>("/api/resources/homes", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createGpioLight(input: { home_id: string; room_id: string | null; name: string; gpio: number }, accessToken: string): Promise<Device> {
  return requestJson<Device>("/api/resources/devices", accessToken, {
    method: "POST",
    body: JSON.stringify({
      home_id: input.home_id,
      room_id: input.room_id,
      name: input.name,
      device_type_key: "esp32_s3_gpio_light",
      config: { hardware: "esp32_s3_gpio_light", gpio: input.gpio, desired_on: false, active_low: false },
    }),
  });
}

export async function createGpioSensor(input: { home_id: string; room_id: string | null; name: string; gpio: number; input_mode: "analog" | "digital"; metric: string; unit: string; sample_interval_ms: number; pull_mode: "none" | "up" | "down" }, accessToken: string): Promise<Device> {
  const config: Record<string, unknown> = {
    hardware: "esp32_s3_gpio_sensor",
    gpio: input.gpio,
    input_mode: input.input_mode,
    metric: input.metric,
    sample_interval_ms: input.sample_interval_ms,
    pull_mode: input.pull_mode,
    enabled: true,
  };
  if (input.unit.trim()) config.unit = input.unit.trim();
  return requestJson<Device>("/api/resources/devices", accessToken, {
    method: "POST",
    body: JSON.stringify({ home_id: input.home_id, room_id: input.room_id, name: input.name, device_type_key: "esp32_s3_gpio_sensor", config }),
  });
}

export type ProtocolSensorKey = "dht11_temperature_humidity" | "dht22_temperature_humidity" | "sensor_bmp180" | "sensor_bmp280" | "sensor_bmp388" | "sensor_bmp390";
export async function createProtocolSensor(input: { home_id: string; room_id: string | null; name: string; sensor_key: ProtocolSensorKey; data_gpio?: number; sda_gpio?: number; scl_gpio?: number; i2c_address?: "0x76" | "0x77"; sampling_interval_seconds: number; temperature_unit: "celsius" | "fahrenheit" }, accessToken: string): Promise<Device> {
  const isDht = input.sensor_key.startsWith("dht");
  const config: Record<string, unknown> = {
    hardware: "isyen_protocol_sensor", sensor_key: input.sensor_key,
    connection: isDht ? "gpio" : "i2c", sampling_interval_seconds: input.sampling_interval_seconds,
    temperature_unit: input.temperature_unit, enabled: true,
  };
  if (isDht) config.data_gpio = input.data_gpio;
  else Object.assign(config, { sda_gpio: input.sda_gpio, scl_gpio: input.scl_gpio, i2c_address: input.i2c_address });
  return requestJson<Device>("/api/resources/devices", accessToken, {
    method: "POST",
    body: JSON.stringify({ home_id: input.home_id, room_id: input.room_id, name: input.name, device_type_key: input.sensor_key, config }),
  });
}

export async function updateDevice(deviceId: string, input: { config: Record<string, unknown> }, accessToken: string): Promise<Device> {
  return requestJson<Device>(`/api/resources/devices/${encodeURIComponent(deviceId)}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
