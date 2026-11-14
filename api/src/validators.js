"use strict";
const { HttpError } = require("./errors");
const VALID_SENSOR_TYPES = new Set([
  "DHT11",
  "DHT22",
  "DHT",
  "MQ2",
  "MQ135",
  "PIR",
  "REED",
]);
const DEVICE_PINS = new Set([4, 5, 13, 14, 16, 17, 18, 21, 22, 23, 25, 33]);
const SENSOR_PINS = new Set([
  4, 5, 13, 14, 15, 16, 17, 18, 21, 22, 23, 25, 33, 34, 35, 36, 39,
]);
function requireText(value, field, max = 80) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new HttpError(400, `${field} আবশ্যক (সর্বোচ্চ ${max} অক্ষর)।`);
  return value.trim();
}
function requireId(value, field = "ID") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, `সঠিক ${field} দিন।`);
  return id;
}
function validatePin(value, allowed) {
  const pin = Number(value);
  if (!Number.isInteger(pin) || !allowed.has(pin))
    throw new HttpError(400, "এই GPIO pin অনুমোদিত নয়।");
  return pin;
}
function requireKeys(body, keys) {
  if (Object.keys(body).some((key) => !keys.includes(key)))
    throw new HttpError(400, "অনুরোধে অচেনা field রয়েছে।");
}
module.exports = {
  VALID_SENSOR_TYPES,
  DEVICE_PINS,
  SENSOR_PINS,
  requireText,
  requireId,
  validatePin,
  requireKeys,
};
