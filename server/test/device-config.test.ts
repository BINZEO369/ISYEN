import assert from 'node:assert/strict';
import test from 'node:test';
import { ESP32_S3_ANALOG_INPUT_GPIO_PINS, ESP32_S3_DIGITAL_INPUT_GPIO_PINS, ESP32_S3_OUTPUT_GPIO_PINS, isSafeEsp32S3OutputPin, isSafeEsp32S3SensorPin, isValidEsp32S3LightConfig, isValidEsp32S3SensorConfig, isValidProtocolSensorConfig } from '../src/routes/resources.js';

test('ESP32-S3 output whitelist contains supported GPIOs and excludes boot, USB and flash/PSRAM pins', () => {
  assert.ok(ESP32_S3_OUTPUT_GPIO_PINS.includes(4));
  assert.ok(ESP32_S3_OUTPUT_GPIO_PINS.includes(48));
  for (const forbidden of [0, 3, 19, 20, 33, 34, 35, 36, 37, 45, 46, -1, 49, 4.5]) {
    assert.equal(isSafeEsp32S3OutputPin(forbidden), false, `GPIO ${forbidden} must not be accepted`);
  }
});

test('GPIO light config requires a safe integer output and a boolean desired state', () => {
  assert.equal(isValidEsp32S3LightConfig({ hardware: 'esp32_s3_gpio_light', gpio: 4, desired_on: false, active_low: false }), true);
  assert.equal(isValidEsp32S3LightConfig({ hardware: 'esp32_s3_gpio_light', gpio: 19, desired_on: true }), false);
  assert.equal(isValidEsp32S3LightConfig({ hardware: 'esp32_s3_gpio_light', gpio: 5, desired_on: 'true' }), false);
  assert.equal(isValidEsp32S3LightConfig({ hardware: 'other', gpio: 5, desired_on: false }), false);
  assert.equal(isValidEsp32S3LightConfig(null), false);
});

test('sensor input pin lists are limited to supported ESP32-S3 GPIOs and ADC1 pins', () => {
  assert.deepEqual(ESP32_S3_DIGITAL_INPUT_GPIO_PINS, [1, 2, ...ESP32_S3_OUTPUT_GPIO_PINS]);
  assert.deepEqual(ESP32_S3_ANALOG_INPUT_GPIO_PINS, [1, 2, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(isSafeEsp32S3SensorPin(1, 'analog'), true);
  assert.equal(isSafeEsp32S3SensorPin(10, 'analog'), true);
  assert.equal(isSafeEsp32S3SensorPin(11, 'analog'), false);
  assert.equal(isSafeEsp32S3SensorPin(21, 'digital'), true);
  for (const forbidden of [0, 3, 19, 20, 33, 34, 35, 36, 37, 45, 46, 49, 4.5]) {
    assert.equal(isSafeEsp32S3SensorPin(forbidden, 'digital'), false, `GPIO ${forbidden} must not be accepted`);
  }
});

test('sensor config requires a named mode, unique metric format, sample interval, pull mode and enabled flag', () => {
  const base = { hardware: 'esp32_s3_gpio_sensor', gpio: 4, input_mode: 'digital', metric: 'door_open', sample_interval_ms: 5000, pull_mode: 'up', enabled: true };
  assert.equal(isValidEsp32S3SensorConfig(base), true);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, gpio: 3 }), false);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, input_mode: 'analog', gpio: 11, pull_mode: 'none' }), false);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, metric: 'Door Open' }), false);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, sample_interval_ms: 999 }), false);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, pull_mode: 'down', input_mode: 'analog', gpio: 4 }), false);
  assert.equal(isValidEsp32S3SensorConfig({ ...base, enabled: 'true' }), false);
  assert.equal(isValidEsp32S3SensorConfig(null), false);
});

test('DHT and BMP protocol config validates model, GPIO/I2C wiring, address and interval', () => {
  const dht = { hardware: 'isyen_protocol_sensor', sensor_key: 'dht22_temperature_humidity', connection: 'gpio', data_gpio: 4, sampling_interval_seconds: 2, temperature_unit: 'celsius', enabled: true };
  const bmp = { hardware: 'isyen_protocol_sensor', sensor_key: 'sensor_bmp280', connection: 'i2c', sda_gpio: 8, scl_gpio: 9, i2c_address: '0x76', sampling_interval_seconds: 10, temperature_unit: 'fahrenheit', enabled: true };
  assert.equal(isValidProtocolSensorConfig(dht), true);
  assert.equal(isValidProtocolSensorConfig(bmp), true);
  assert.equal(isValidProtocolSensorConfig({ ...dht, data_gpio: 3 }), false);
  assert.equal(isValidProtocolSensorConfig({ ...bmp, scl_gpio: 8 }), false);
  assert.equal(isValidProtocolSensorConfig({ ...bmp, i2c_address: '0x78' }), false);
  assert.equal(isValidProtocolSensorConfig({ ...bmp, sampling_interval_seconds: 1 }), false);
});
