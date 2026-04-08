const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { sendResponse } = require("../utils/apiResponse");

// ─── Register ────────────────────────────────────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, college } = req.body;

  // Prevent arbitrary admin self-registration
  if (role === "admin")
    throw new ApiError(403, "Cannot self-register as admin.");

  const existing = await User.findOne({ email });
  if (existing)
    throw new ApiError(409, "An account with this email already exists.");

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    college,
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return sendResponse(
    res,
    201,
    { user, accessToken, refreshToken },
    "Registration successful",
  );
});

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) throw new ApiError(401, "Invalid email or password.");
  if (!user.isActive)
    throw new ApiError(403, "Your account has been deactivated.");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Invalid email or password.");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const userData = user.toJSON();
  return sendResponse(
    res,
    200,
    { user: userData, accessToken, refreshToken },
    "Login successful",
  );
});

// ─── Refresh access token ─────────────────────────────────────────────────────
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, "Refresh token is required.");

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token.");
  }

  const user = await User.findById(decoded.id).select("+refreshToken");
  if (!user || user.refreshToken !== refreshToken)
    throw new ApiError(401, "Refresh token mismatch. Please log in again.");

  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  return sendResponse(
    res,
    200,
    {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
    "Token refreshed",
  );
});

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: "" } });
  return sendResponse(res, 200, null, "Logged out successfully");
});

// ─── Get current user ─────────────────────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  return sendResponse(res, 200, { user });
});

// ─── Update profile ───────────────────────────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone", "college", "location"];
  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  if (req.file) updates.avatar = req.file.path;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  return sendResponse(res, 200, { user }, "Profile updated");
});

// ─── Change password ──────────────────────────────────────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw new ApiError(400, "Current password is incorrect.");

  user.password = newPassword;
  await user.save();

  return sendResponse(res, 200, null, "Password changed successfully");
});
