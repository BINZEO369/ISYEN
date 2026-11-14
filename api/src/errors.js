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
        error: "This gateway claim code or hardware address is already in use.",
      },
    };
  if (error && error.code === "23503")
    return {
      status: 409,
      body: {
        error: "Related data exists for this device; remove child records first.",
      },
    };
  if (error && error.code === "23514")
    return {
      status: 400,
      body: { error: "The provided value does not match the allowed database values." },
    };
  return {
    status: 500,
    body: { error: "A server error occurred. Please try again later." },
  };
}
module.exports = { HttpError, apiError };
