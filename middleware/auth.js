const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

// ─── Verify access token ──────────────────────────────────────────────────────
const protect = asyncHandler(async (req, _res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) throw new ApiError(401, "Not authenticated. Please log in.");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw new ApiError(401, "Access token expired.");
    throw new ApiError(401, "Invalid token.");
  }

  const user = await User.findById(decoded.id).select(
    "-password -refreshToken",
  );
  if (!user) throw new ApiError(401, "User no longer exists.");
  if (!user.isActive)
    throw new ApiError(403, "Your account has been deactivated.");

  req.user = user;
  next();
});

// ─── Optional auth (attaches user if token present, does NOT fail without) ───
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
  } catch {
    // silently ignore
  }
  next();
});

module.exports = { protect, optionalAuth };
