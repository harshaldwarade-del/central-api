const DiscountCode = require("../models/DiscountCode");
const Mess = require("../models/Mess");
const Redemption = require("../models/Redemption");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { sendResponse } = require("../utils/apiResponse");
const codeService = require("../services/code.service");

// ─── POST /api/mess/:messId/codes  [mess_owner] — generate new code ───────────
exports.createCode = asyncHandler(async (req, res) => {
  const mess = await Mess.findOne({
    _id: req.params.messId,
    owner: req.user._id,
  });
  if (!mess) throw new ApiError(404, "Mess not found or you do not own it.");
  if (!mess.isApproved)
    throw new ApiError(
      403,
      "Your mess must be approved before generating codes.",
    );

  const {
    discountType,
    discountValue,
    maxUses,
    perUserLimit,
    minOrderValue,
    maxDiscount,
    validFrom,
    validTill,
    description,
  } = req.body;

  const code = await codeService.generateCode(mess.name);

  const shareableLink = codeService.getShareableLink(
    "PENDING",
    process.env.CLIENT_URL || "https://messplatform.app",
  );

  const discountDoc = await DiscountCode.create({
    mess: req.params.messId,
    code,
    discountType,
    discountValue,
    maxUses: maxUses ?? null,
    perUserLimit: perUserLimit ?? 1,
    minOrderValue: minOrderValue ?? 0,
    maxDiscount: maxDiscount ?? null,
    validFrom: validFrom ?? new Date(),
    validTill: validTill ?? null,
    description,
    createdBy: req.user._id,
    shareableLink,
  });

  // Update shareable link with actual id
  discountDoc.shareableLink = codeService.getShareableLink(
    discountDoc._id,
    process.env.CLIENT_URL || "https://messplatform.app",
  );
  await discountDoc.save();

  return sendResponse(
    res,
    201,
    { discountCode: discountDoc },
    "Discount code created",
  );
});

// ─── GET /api/mess/:messId/codes  [mess_owner] ───────────────────────────────
exports.getCodesForMess = asyncHandler(async (req, res) => {
  const mess = await Mess.findOne({
    _id: req.params.messId,
    owner: req.user._id,
  });
  if (!mess) throw new ApiError(404, "Mess not found or you do not own it.");

  const { active, page = 1, limit = 20 } = req.query;
  const filter = { mess: req.params.messId };
  if (active !== undefined) filter.isActive = active === "true";

  const skip = (page - 1) * limit;
  const [codes, total] = await Promise.all([
    DiscountCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit),
    DiscountCode.countDocuments(filter),
  ]);

  return sendResponse(res, 200, {
    codes,
    total,
    page: +page,
    pages: Math.ceil(total / +limit),
  });
});

// ─── POST /api/discount/validate  [student] ───────────────────────────────────
exports.validateCode = asyncHandler(async (req, res) => {
  const { code, messId } = req.body;
  if (!code || !messId)
    throw new ApiError(400, "code and messId are required.");

  console.log(code, messId);

  const discountCode = await codeService.validateCode(
    code,
    messId,
    req.user._id,
  );

  return sendResponse(
    res,
    200,
    {
      code: discountCode.code,
      discountType: discountCode.discountType,
      discountValue: discountCode.discountValue,
      minOrderValue: discountCode.minOrderValue,
      maxDiscount: discountCode.maxDiscount,
      validTill: discountCode.validTill,
      description: discountCode.description,
    },
    "Code is valid",
  );
});

// ─── POST /api/discount/redeem  [student] ─────────────────────────────────────
exports.redeemCode = asyncHandler(async (req, res) => {
  const { code, messId, billAmount, sharedBy } = req.body;
  if (!code || !messId || !billAmount)
    throw new ApiError(400, "code, messId, and billAmount are required.");

  const result = await codeService.redeemCode({
    codeString: code,
    messId,
    userId: req.user._id,
    billAmount,
    sharedBy,
  });

  return sendResponse(res, 200, result, "Code redeemed successfully!");
});

// ─── POST /api/discount/share  [student | mess_owner] ────────────────────────
exports.shareCode = asyncHandler(async (req, res) => {
  const { codeId } = req.body;
  const code = await DiscountCode.findById(codeId).populate("mess", "name");
  if (!code || !code.isActive)
    throw new ApiError(404, "Code not found or inactive.");

  const shareableLink = codeService.getShareableLink(
    codeId,
    process.env.CLIENT_URL || "https://messplatform.app",
  );

  return sendResponse(
    res,
    200,
    {
      shareableLink,
      code: code.code,
      messName: code.mess.name,
    },
    "Shareable link generated",
  );
});

// ─── PATCH /api/mess/:messId/codes/:codeId/toggle  [mess_owner] ──────────────
exports.toggleCode = asyncHandler(async (req, res) => {
  const code = await DiscountCode.findOne({
    _id: req.params.codeId,
    mess: req.params.messId,
  });
  if (!code) throw new ApiError(404, "Code not found.");

  // Verify ownership
  const mess = await Mess.findOne({
    _id: req.params.messId,
    owner: req.user._id,
  });
  if (!mess) throw new ApiError(403, "You do not own this mess.");

  code.isActive = !code.isActive;
  await code.save();

  return sendResponse(
    res,
    200,
    { code },
    `Code ${code.isActive ? "activated" : "deactivated"}`,
  );
});

// ─── GET /api/mess/:messId/redemptions  [mess_owner] — redemption history ─────
exports.getRedemptions = asyncHandler(async (req, res) => {
  const mess = await Mess.findOne({
    _id: req.params.messId,
    owner: req.user._id,
  });
  if (!mess) throw new ApiError(404, "Mess not found or you do not own it.");

  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [redemptions, total, stats] = await Promise.all([
    Redemption.find({ mess: req.params.messId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("student", "name email phone")
      .populate("code", "code discountType discountValue"),
    Redemption.countDocuments({ mess: req.params.messId }),
    codeService.getRedemptionStats(req.params.messId),
  ]);

  return sendResponse(res, 200, {
    redemptions,
    total,
    page: +page,
    pages: Math.ceil(total / +limit),
    stats,
  });
});

// ─── GET /api/discount/history  [student] ─────────────────────────────────────
exports.getMyRedemptions = asyncHandler(async (req, res) => {
  const redemptions = await Redemption.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .populate("mess", "name address images")
    .populate("code", "code discountType discountValue");

  return sendResponse(res, 200, { redemptions });
});
