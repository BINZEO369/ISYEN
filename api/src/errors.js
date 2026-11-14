"use strict";
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
function apiError(error) {
  if (error instanceof HttpError)
    return {
      status: error.status,
      body: {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
    };
  if (error && error.code === "23505")
    return {
      status: 409,
      body: {
        error: "এই gateway claim code বা hardware address আগে থেকেই ব্যবহৃত।",
      },
    };
  if (error && error.code === "23503")
    return {
      status: 409,
      body: {
        error: "সংশ্লিষ্ট device-এ data যুক্ত আছে; আগে child records সরান।",
      },
    };
  if (error && error.code === "23514")
    return {
      status: 400,
      body: { error: "ডাটাবেজের অনুমোদিত মানের সঙ্গে তথ্য মিলছে না।" },
    };
  return {
    status: 500,
    body: { error: "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।" },
  };
}
module.exports = { HttpError, apiError };
