const router = require("express").Router();
const ctrl = require("../controllers/discount.controller");
const { protect } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const { codeLimiter, apiLimiter } = require("../middleware/rateLimiter");

router.use(apiLimiter);

// ─── Mess owner ───────────────────────────────────────────────────────────────
// Mounted at /api/mess (same prefix as mess router, so we get /:messId/...)
// These are also wired via server.js using app.use('/api/mess', discountRoutes)

// Generate a code
router.post(
  "/:messId/codes",
  protect,
  authorize("mess_owner"),
  codeLimiter,
  ctrl.createCode,
);

// List codes for a mess
router.get(
  "/:messId/codes",
  protect,
  authorize("mess_owner"),
  ctrl.getCodesForMess,
);

// Toggle code active/inactive
router.patch(
  "/:messId/codes/:codeId/toggle",
  protect,
  authorize("mess_owner"),
  ctrl.toggleCode,
);

// Redemption history for a mess
router.get(
  "/:messId/redemptions",
  protect,
  authorize("mess_owner"),
  ctrl.getRedemptions,
);

// ─── Student ──────────────────────────────────────────────────────────────────
// These are at /api/discount/...

// Validate without consuming
router.post("/validate", protect, authorize("student"), ctrl.validateCode);

// Redeem (consumes the code)
router.post("/redeem", protect, authorize("student"), ctrl.redeemCode);

// Generate shareable link
router.post("/share", protect, ctrl.shareCode);

// Student redemption history
router.get("/history", protect, authorize("student"), ctrl.getMyRedemptions);

module.exports = router;
