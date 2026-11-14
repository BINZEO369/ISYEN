"use client";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://isyen-api.vercel.app"
).replace(/\/+$/, "");

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const DEVICE_PINS = [4, 5, 13, 14, 16, 17, 18, 21, 22, 23, 25, 33];
export const SENSOR_PINS = [
  4, 5, 13, 14, 15, 16, 17, 18, 21, 22, 23, 25, 33, 34, 35, 36, 39,
];
