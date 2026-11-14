"use client";

import { createClient } from "@supabase/supabase-js";

export const DEVICE_PINS = [4, 5, 13, 14, 16, 17, 18, 21, 22, 23, 25, 33];
export const SENSOR_PINS = [
  4, 5, 13, 14, 15, 16, 17, 18, 21, 22, 23, 25, 33, 34, 35, 36, 39,
];

const runtime = Object.freeze({
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://fabasazefdnkpygglajz.supabase.co",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  apiBaseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, ""),
});

let client;
export async function getRuntime() {
  return runtime;
}
export async function getSupabase() {
  if (!runtime.supabaseAnonKey) {
    throw new Error(
      "Supabase anon key পাওয়া যায়নি। NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable সেট করুন।",
    );
  }
  return (client ||= createClient(
    runtime.supabaseUrl,
    runtime.supabaseAnonKey,
  ));
}
