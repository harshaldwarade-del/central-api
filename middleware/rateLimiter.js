const rateLimit = require("express-rate-limit");

const makeLimit = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Strict limit for auth endpoints (prevents brute force)
const authLimiter = makeLimit(
  15,
  10,
  "Too many login attempts. Try again after 15 minutes.",
);

// General API limit
const apiLimiter = makeLimit(15, 200, "Too many requests. Please slow down.");

// Code generation limit (prevents code spam by mess owners)
const codeLimiter = makeLimit(
  60,
  20,
  "Too many codes generated. Try again in an hour.",
);

module.exports = { authLimiter, apiLimiter, codeLimiter };
