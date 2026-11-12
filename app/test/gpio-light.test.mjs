import assert from "node:assert/strict";
import { test } from "node:test";
import { createGpioLight } from "../lib/app-data.ts";

test("GPIO light creation sends gpio only inside the writable config field", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestInit;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ data: { id: "device-1" } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await createGpioLight({ home_id: "home-1", room_id: null, name: "Living room light", gpio: 4 }, "test-token");

    assert.equal(requestUrl, "/api/resources/devices");
    assert.equal(requestInit.method, "POST");
    const payload = JSON.parse(requestInit.body);
    assert.deepEqual(payload, {
      home_id: "home-1",
      room_id: null,
      name: "Living room light",
      device_type_key: "esp32_s3_gpio_light",
      config: { hardware: "esp32_s3_gpio_light", gpio: 4, desired_on: false, active_low: false },
    });
    assert.equal(Object.hasOwn(payload, "gpio"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
