"use client";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://isyen-api.vercel.app"
).replace(/\/+$/, "");
export const SESSION_KEY = "isyen.auth.session";

export function apiUrl(path) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
