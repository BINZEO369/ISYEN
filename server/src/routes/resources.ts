export type FieldRule =
  | 'text' | 'requiredText' | 'nullableText'
  | 'uuid' | 'nullableUuid'
  | 'integer' | 'nullableInteger'
  | 'number' | 'nullableNumber'
  | 'boolean' | 'object'
  | 'homeStatus' | 'gatewayStatus' | 'deviceStatus' | 'integrationStatus' | 'deviceTypeKey'
  | 'timeFormat' | 'temperatureUnit' | 'theme' | 'deviceView'
  | 'date' | 'nullableDate' | 'dateTime' | 'nullableDateTime';

export interface ResourceDefinition {
  /** Explicit projection prevents connection/provider credentials from being returned. */
  select: string;
  /** Only these columns may be supplied by a signed-in user. */
  writable: Readonly<Record<string, FieldRule>>;
  /** Required payload fields for inserts. */
  requiredOnCreate: readonly string[];
  /** Per-table list filters and their input types. */
  filters: Readonly<Record<string, FieldRule>>;
  /** Columns accepted by order_by for this table. */
  orderBy: readonly string[];
  defaultOrderBy: string;
  write: boolean;
  serviceOnly?: boolean;
  shared?: boolean;
  /** Restrict reads and updates to auth_user_id = authenticated user. */
  selfOnly?: boolean;
}

const text = 'text' satisfies FieldRule;
const nullableText = 'nullableText' satisfies FieldRule;
const requiredText = 'requiredText' satisfies FieldRule;
const uuid = 'uuid' satisfies FieldRule;
const nullableUuid = 'nullableUuid' satisfies FieldRule;
const integer = 'integer' satisfies FieldRule;
const nullableInteger = 'nullableInteger' satisfies FieldRule;
const nullableNumber = 'nullableNumber' satisfies FieldRule;
const boolean = 'boolean' satisfies FieldRule;
const object = 'object' satisfies FieldRule;

export const ESP32_S3_OUTPUT_GPIO_PINS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47, 48] as const;
const safeEsp32S3OutputPins = new Set<number>(ESP32_S3_OUTPUT_GPIO_PINS);

export function isSafeEsp32S3OutputPin(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && safeEsp32S3OutputPins.has(value);
}

export function isValidEsp32S3LightConfig(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return config.hardware === 'esp32_s3_gpio_light'
    && isSafeEsp32S3OutputPin(config.gpio)
    && typeof config.desired_on === 'boolean'
    && (config.active_low === undefined || typeof config.active_low === 'boolean');
}

const resourceDefinitions = {
  homes: {
    select: 'id,name,description,address,timezone,status,metadata,created_at,updated_at',
    writable: { name: requiredText, description: nullableText, address: object, timezone: requiredText, status: 'homeStatus', metadata: object },
    requiredOnCreate: ['name'], filters: { status: 'homeStatus' },
    orderBy: ['created_at', 'updated_at', 'name', 'status'], defaultOrderBy: 'created_at', write: true,
  },
  home_settings: {
    select: 'id,home_id,settings,created_at,updated_at',
    writable: { home_id: uuid, settings: object }, requiredOnCreate: ['home_id'],
    filters: { home_id: uuid }, orderBy: ['created_at', 'updated_at'], defaultOrderBy: 'updated_at', write: true,
  },
  rooms: {
    select: 'id,home_id,name,room_type,floor,sort_order,metadata,created_at,updated_at',
    writable: { home_id: uuid, name: requiredText, room_type: nullableText, floor: nullableInteger, sort_order: integer, metadata: object },
    requiredOnCreate: ['home_id', 'name'], filters: { home_id: uuid },
    orderBy: ['created_at', 'updated_at', 'name', 'sort_order'], defaultOrderBy: 'created_at', write: true,
  },
  zones: {
    select: 'id,home_id,room_id,name,zone_type,metadata,created_at,updated_at',
    writable: { home_id: uuid, room_id: nullableUuid, name: requiredText, zone_type: nullableText, metadata: object },
    requiredOnCreate: ['home_id', 'name'], filters: { home_id: uuid, room_id: uuid },
    orderBy: ['created_at', 'updated_at', 'name'], defaultOrderBy: 'created_at', write: true,
  },
  device_types: {
    select: 'id,key,name,category,manufacturer,capabilities,default_config,is_active,created_at,updated_at',
    writable: {}, requiredOnCreate: [], filters: { key: text, category: text, is_active: boolean },
    orderBy: ['created_at', 'updated_at', 'key', 'name', 'category'], defaultOrderBy: 'name',
    write: false, shared: true,
  },
  gateways: {
    select: 'id,home_id,name,gateway_type,serial_number,status,last_seen_at,metadata,created_at,updated_at',
    writable: { home_id: uuid, name: requiredText, gateway_type: requiredText, serial_number: nullableText, metadata: object },
    requiredOnCreate: ['home_id', 'name', 'gateway_type'], filters: { home_id: uuid, gateway_type: text, status: 'gatewayStatus' },
    orderBy: ['created_at', 'updated_at', 'name', 'status', 'last_seen_at'], defaultOrderBy: 'created_at', write: true,
  },
  devices: {
    select: 'id,home_id,room_id,zone_id,gateway_id,device_type_id,name,external_id,status,config,metadata,last_seen_at,created_at,updated_at',
    writable: { home_id: uuid, room_id: nullableUuid, zone_id: nullableUuid, gateway_id: nullableUuid, device_type_id: uuid, device_type_key: 'deviceTypeKey', name: requiredText, external_id: nullableText, config: object, metadata: object },
    requiredOnCreate: ['home_id', 'name'],
    filters: { home_id: uuid, room_id: uuid, zone_id: uuid, gateway_id: uuid, device_type_id: uuid, status: 'deviceStatus' },
    orderBy: ['created_at', 'updated_at', 'name', 'status', 'last_seen_at'], defaultOrderBy: 'created_at', write: true,
  },
  device_states: {
    select: 'id,device_id,state,reported_at,received_at,source', writable: {}, requiredOnCreate: [],
    filters: { device_id: uuid, source: text }, orderBy: ['reported_at', 'received_at'], defaultOrderBy: 'reported_at',
    write: false, serviceOnly: true,
  },
  device_logs: {
    select: 'id,device_id,event_type,payload,occurred_at,created_at', writable: {}, requiredOnCreate: [],
    filters: { device_id: uuid, event_type: text }, orderBy: ['occurred_at', 'created_at'], defaultOrderBy: 'occurred_at',
    write: false, serviceOnly: true,
  },
  automations: {
    select: 'id,home_id,name,description,is_enabled,trigger_config,condition_config,action_config,metadata,created_at,updated_at',
    writable: { home_id: uuid, name: requiredText, description: nullableText, is_enabled: boolean, trigger_config: object, condition_config: object, action_config: object, metadata: object },
    requiredOnCreate: ['home_id', 'name'], filters: { home_id: uuid, is_enabled: boolean },
    orderBy: ['created_at', 'updated_at', 'name', 'is_enabled'], defaultOrderBy: 'created_at', write: true,
  },
  automation_logs: {
    select: 'id,automation_id,status,details,occurred_at', writable: {}, requiredOnCreate: [],
    filters: { automation_id: uuid, status: text }, orderBy: ['occurred_at'], defaultOrderBy: 'occurred_at',
    write: false, serviceOnly: true,
  },
  scenes: {
    select: 'id,home_id,name,description,icon,is_enabled,metadata,created_at,updated_at',
    writable: { home_id: uuid, name: requiredText, description: nullableText, icon: nullableText, is_enabled: boolean, metadata: object },
    requiredOnCreate: ['home_id', 'name'], filters: { home_id: uuid, is_enabled: boolean },
    orderBy: ['created_at', 'updated_at', 'name', 'is_enabled'], defaultOrderBy: 'created_at', write: true,
  },
  scene_devices: {
    select: 'id,scene_id,device_id,command,sort_order,created_at',
    writable: { scene_id: uuid, device_id: uuid, command: object, sort_order: integer },
    requiredOnCreate: ['scene_id', 'device_id'], filters: { scene_id: uuid, device_id: uuid },
    orderBy: ['created_at', 'sort_order'], defaultOrderBy: 'sort_order', write: true,
  },
  schedules: {
    select: 'id,home_id,automation_id,scene_id,name,cron_expression,timezone,starts_at,ends_at,is_enabled,config,created_at,updated_at',
    writable: { home_id: uuid, automation_id: nullableUuid, scene_id: nullableUuid, name: requiredText, cron_expression: nullableText, timezone: requiredText, starts_at: 'nullableDateTime', ends_at: 'nullableDateTime', is_enabled: boolean, config: object },
    requiredOnCreate: ['home_id', 'name'], filters: { home_id: uuid, automation_id: uuid, scene_id: uuid, is_enabled: boolean },
    orderBy: ['created_at', 'updated_at', 'name', 'starts_at', 'is_enabled'], defaultOrderBy: 'created_at', write: true,
  },
  sensor_data: {
    select: 'id,home_id,device_id,metric,value_numeric,value_text,unit,data,recorded_at', writable: {}, requiredOnCreate: [],
    filters: { home_id: uuid, device_id: uuid, metric: text }, orderBy: ['recorded_at'], defaultOrderBy: 'recorded_at',
    write: false, serviceOnly: true,
  },
  notifications: {
    select: 'id,home_id,device_id,notification_type,title,body,severity,channel,is_read,data,created_at,read_at', writable: {}, requiredOnCreate: [],
    filters: { home_id: uuid, device_id: uuid, notification_type: text, severity: text, is_read: boolean },
    orderBy: ['created_at', 'severity', 'is_read'], defaultOrderBy: 'created_at', write: false, serviceOnly: true,
  },
  integrations: {
    // config and credentials_ref are deliberately excluded from API responses.
    select: 'id,home_id,provider,external_account_id,status,last_synced_at,created_at,updated_at',
    writable: { home_id: nullableUuid, provider: requiredText, external_account_id: nullableText },
    requiredOnCreate: ['provider'], filters: { home_id: uuid, provider: text, status: 'integrationStatus' },
    orderBy: ['created_at', 'updated_at', 'last_synced_at', 'provider', 'status'], defaultOrderBy: 'created_at', write: true,
  },
  firmware_updates: {
    select: 'id,device_id,version,firmware_url,checksum,status,progress,error_message,started_at,completed_at,created_at', writable: {}, requiredOnCreate: [],
    filters: { device_id: uuid, status: text }, orderBy: ['created_at', 'started_at', 'completed_at', 'status', 'progress'], defaultOrderBy: 'created_at',
    write: false, serviceOnly: true,
  },
  security_events: {
    select: 'id,home_id,device_id,event_type,severity,details,occurred_at', writable: {}, requiredOnCreate: [],
    filters: { home_id: uuid, device_id: uuid, event_type: text, severity: text }, orderBy: ['occurred_at', 'severity'], defaultOrderBy: 'occurred_at',
    write: false, serviceOnly: true,
  },
  admin_users: {
    select: 'id,email,role,status,permissions,last_login_at,created_at,updated_at', writable: {}, requiredOnCreate: [],
    filters: { status: text }, orderBy: ['created_at', 'updated_at', 'email', 'role', 'status'], defaultOrderBy: 'created_at',
    write: false, serviceOnly: true, selfOnly: true,
  },
  user_profiles: {
    select: 'id,first_name,last_name,full_name,profile_photo,date_of_birth,gender,phone_number,email,bio,country,state,city,postal_code,address_line_1,address_line_2,latitude,longitude,language,currency,timezone,date_format,time_format,temperature_unit,theme,push_notifications,email_notifications,sms_notifications,security_alerts,device_alerts,automation_alerts,profile_status,profile_completion,created_at,updated_at',
    writable: {
      first_name: nullableText, last_name: nullableText, full_name: nullableText, profile_photo: nullableText, date_of_birth: 'nullableDate', gender: nullableText, phone_number: nullableText, bio: nullableText,
      country: nullableText, state: nullableText, city: nullableText, postal_code: nullableText, address_line_1: nullableText, address_line_2: nullableText,
      latitude: nullableNumber, longitude: nullableNumber, language: requiredText, currency: requiredText, timezone: requiredText,
      date_format: requiredText, time_format: 'timeFormat', temperature_unit: 'temperatureUnit', theme: 'theme',
      push_notifications: boolean, email_notifications: boolean, sms_notifications: boolean, security_alerts: boolean,
      device_alerts: boolean, automation_alerts: boolean,
    },
    requiredOnCreate: [], filters: {}, orderBy: ['created_at', 'updated_at', 'full_name', 'email'], defaultOrderBy: 'updated_at',
    write: true, selfOnly: true,
  },
} satisfies Record<string, ResourceDefinition>;

export type ResourceName = keyof typeof resourceDefinitions;
export const resources: Record<ResourceName, ResourceDefinition> = resourceDefinitions;
export const resourceNames = Object.keys(resourceDefinitions) as ResourceName[];

export function isResourceName(value: string): value is ResourceName {
  return Object.hasOwn(resourceDefinitions, value);
}
