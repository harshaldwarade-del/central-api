const crypto = require("crypto");
const DiscountCode = require("../models/DiscountCode");
const Redemption = require("../models/Redemption");
const ApiError = require("../utils/apiError");
const { setEx, get, incr } = require("../config/redis");

const CODE_TTL_SECONDS = 600; // 10 min Redis lock per code per user

// ─── Generate a unique, human-readable code ───────────────────────────────────
const generateCode = async (messName) => {
  const prefix = messName
    .replace(/[^a-zA-Z]/g, "")
    .substring(0, 4)
    .toUpperCase()
    .padEnd(4, "X");

  let code, exists;
  let attempts = 0;
  do {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    code = `${prefix}-${suffix}`; // e.g.  SHIV-A3F9B2
    exists = await DiscountCode.exists({ code });
    attempts++;
    if (attempts > 10)
      throw new ApiError(500, "Could not generate a unique code. Try again.");
  } while (exists);

  return code;
};

// ─── Validate a code (does NOT consume it) ────────────────────────────────────
const validateCode = async (codeString, messId, userId) => {
  const code = await DiscountCode.findOne({
    code: codeString.toUpperCase().trim(),
    mess: messId,
    isActive: true,
  });

  if (!code) throw new ApiError(404, "Invalid or expired discount code.");

  const now = new Date();
  if (code.validFrom && now < code.validFrom)
    throw new ApiError(400, "This code is not yet active.");

  if (code.validTill && now > code.validTill)
    throw new ApiError(400, "This discount code has expired.");

  if (code.maxUses !== null && code.usedCount >= code.maxUses)
    throw new ApiError(400, "This code has reached its maximum usage limit.");

  // Per-user usage check
  const userUses = await Redemption.countDocuments({
    code: code._id,
    student: userId,
    status: { $in: ["pending", "confirmed"] },
  });
  if (userUses >= code.perUserLimit)
    throw new ApiError(
      400,
      `You have already used this code ${code.perUserLimit} time(s).`,
    );

  return code;
};

// ─── Calculate discount amount ────────────────────────────────────────────────
const calculateDiscount = (code, billAmount) => {
  if (billAmount < code.minOrderValue)
    throw new ApiError(
      400,
      `Minimum order value for this code is ₹${code.minOrderValue}.`,
    );

  let savings;
  if (code.discountType === "percentage") {
    savings = (billAmount * code.discountValue) / 100;
    if (code.maxDiscount) savings = Math.min(savings, code.maxDiscount);
  } else {
    savings = code.discountValue;
  }

  savings = Math.min(savings, billAmount); // can't save more than the bill
  return {
    savings: Math.round(savings * 100) / 100,
    finalAmount: billAmount - savings,
  };
};

// ─── Redeem a code (atomic) ───────────────────────────────────────────────────
const redeemCode = async ({
  codeString,
  messId,
  userId,
  billAmount,
  sharedBy,
}) => {
  // Redis distributed lock — prevents double-spend in concurrent requests
  const lockKey = `redeem_lock:${codeString}:${userId}`;
  const locked = await get(lockKey);
  if (locked)
    throw new ApiError(429, "Redemption already in progress. Please wait.");
  await setEx(lockKey, 30, "1");

  try {
    const code = await validateCode(codeString, messId, userId);
    const { savings, finalAmount } = calculateDiscount(
      code,
      parseFloat(billAmount),
    );

    const [redemption] = await Promise.all([
      Redemption.create({
        code: code._id,
        mess: messId,
        student: userId,
        sharedBy: sharedBy || null,
        billAmount: parseFloat(billAmount),
        savings,
        status: "confirmed",
        confirmedAt: new Date(),
        codeString: code.code,
      }),
      DiscountCode.findByIdAndUpdate(code._id, { $inc: { usedCount: 1 } }),
    ]);

    return { redemption, savings, finalAmount };
  } finally {
    // Always release lock
    const { del } = require("../config/redis");
    await del(lockKey);
  }
};

// ─── Generate shareable link ──────────────────────────────────────────────────
const getShareableLink = (codeId, baseUrl) => {
  const token = Buffer.from(`${codeId}:${Date.now()}`).toString("base64url");
  return `${baseUrl}/app/code/${token}`;
};

// ─── Get redemption stats for a mess ─────────────────────────────────────────
const getRedemptionStats = async (messId) => {
  const stats = await Redemption.aggregate([
    {
      $match: {
        mess: new require("mongoose").Types.ObjectId(messId),
        status: "confirmed",
      },
    },
    {
      $group: {
        _id: null,
        totalRedemptions: { $sum: 1 },
        totalSavings: { $sum: "$savings" },
        totalRevenue: { $sum: "$billAmount" },
        avgBill: { $avg: "$billAmount" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalRedemptions: 0,
      totalSavings: 0,
      totalRevenue: 0,
      avgBill: 0,
    }
  );
};

module.exports = {
  generateCode,
  validateCode,
  calculateDiscount,
  redeemCode,
  getShareableLink,
  getRedemptionStats,
};
