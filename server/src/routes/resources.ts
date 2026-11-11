export const resources = {
  homes: { write: true, serviceOnly: false, shared: false },
  home_settings: { write: true, serviceOnly: false, shared: false },
  rooms: { write: true, serviceOnly: false, shared: false },
  zones: { write: true, serviceOnly: false, shared: false },
  devices: { write: true, serviceOnly: false, shared: false },
  device_types: { write: false, serviceOnly: false, shared: true },
  device_states: { write: false, serviceOnly: true, shared: false },
  device_logs: { write: false, serviceOnly: true, shared: false },
  gateways: { write: true, serviceOnly: false, shared: false },
  automations: { write: true, serviceOnly: false, shared: false },
  automation_logs: { write: false, serviceOnly: true, shared: false },
  scenes: { write: true, serviceOnly: false, shared: false },
  scene_devices: { write: true, serviceOnly: false, shared: false },
  schedules: { write: true, serviceOnly: false, shared: false },
  sensor_data: { write: false, serviceOnly: true, shared: false },
  notifications: { write: false, serviceOnly: true, shared: false },
  integrations: { write: true, serviceOnly: false, shared: false },
  firmware_updates: { write: false, serviceOnly: true, shared: false },
  security_events: { write: false, serviceOnly: true, shared: false },
  admin_users: { write: false, serviceOnly: true, shared: false },
  user_profiles: { write: true, serviceOnly: false, shared: false },
} as const;

export type ResourceName = keyof typeof resources;
export const resourceNames = Object.keys(resources) as ResourceName[];

export function isResourceName(value: string): value is ResourceName {
  return resourceNames.includes(value as ResourceName);
}

export const protectedFields = new Set([
  'id',
  'auth_user_id',
  'isyen_id',
  'created_at',
  'updated_at',
  'profile_status',
  'profile_completion',
]);

export const allowedOrderFields = new Set([
  'created_at',
  'updated_at',
  'name',
  'email',
  'occurred_at',
  'recorded_at',
  'last_seen_at',
  'is_read',
  'is_enabled',
  'status',
]);
