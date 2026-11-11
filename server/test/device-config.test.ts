import assert from 'node:assert/strict';
import test from 'node:test';
import { ESP32_S3_OUTPUT_GPIO_PINS, isSafeEsp32S3OutputPin, isValidEsp32S3LightConfig } from '../src/routes/resources.js';

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
