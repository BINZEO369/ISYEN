"use strict";
const { HttpError } = require("../errors");
const { readBody } = require("../http");
const { supabaseAuthRequest, supabaseRequest } = require("../supabase");

async function credentials(req) {
  const body = await readBody(req);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "সঠিক ইমেইল ঠিকানা দিন।");
  if (password.length < 6 || password.length > 256)
    throw new HttpError(400, "পাসওয়ার্ড ৬ থেকে ২৫৬ অক্ষরের মধ্যে হতে হবে।");
  return { email, password };
}

function bearerToken(req) {
  const authorization = req.headers?.authorization;
  const match = typeof authorization === "string"
    ? authorization.match(/^Bearer\s+(.+)$/i)
    : null;
  if (!match) throw new HttpError(401, "সেশনটি নেই; আবার লগ ইন করুন।", "AUTH_REQUIRED");
  return match[1].trim();
}

async function register(req, config) {
  const body = await credentials(req);
  const result = await supabaseAuthRequest(config, "/auth/v1/signup", {
    method: "POST",
    body,
  });
  const session = result?.access_token ? result : null;
  return {
    status: 201,
    body: {
      session,
      user: result?.user || result || null,
      needsEmailVerification: !session,
    },
  };
}

async function login(req, config) {
  const body = await credentials(req);
  const session = await supabaseAuthRequest(
    config,
    "/auth/v1/token?grant_type=password",
    { method: "POST", body },
  );
  if (!session?.access_token || !session?.refresh_token || !session?.user)
    throw new HttpError(502, "লগ ইন হলেও নিরাপদ session তৈরি হয়নি।");
  return { session };
}

async function refresh(req, config) {
  const body = await readBody(req);
  const refreshToken = typeof body.refresh_token === "string"
    ? body.refresh_token.trim()
    : "";
  if (!refreshToken)
    throw new HttpError(400, "Session refresh token পাওয়া যায়নি।");
  const session = await supabaseAuthRequest(
    config,
    "/auth/v1/token?grant_type=refresh_token",
    { method: "POST", body: { refresh_token: refreshToken } },
  );
  if (!session?.access_token || !session?.refresh_token || !session?.user)
    throw new HttpError(401, "সেশনটি মেয়াদোত্তীর্ণ; আবার লগ ইন করুন।", "INVALID_SESSION");
  return { session };
}

async function currentUser(req, config) {
  const user = await supabaseRequest(config, bearerToken(req), "/auth/v1/user");
  if (!user?.id)
    throw new HttpError(401, "সেশনটি মেয়াদোত্তীর্ণ; আবার লগ ইন করুন।", "INVALID_SESSION");
  return { user };
}

async function logout(req, config) {
  await supabaseAuthRequest(config, "/auth/v1/logout", {
    method: "POST",
    accessToken: bearerToken(req),
  });
  return { ok: true };
}

module.exports = { register, login, refresh, currentUser, logout };
