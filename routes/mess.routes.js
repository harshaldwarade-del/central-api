const router = require("express").Router();
const ctrl = require("../controllers/mess.controller");
const { protect, optionalAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const { apiLimiter } = require("../middleware/rateLimiter");
const { uploadMessImages } = require("../config/cloudinary");

router.use(apiLimiter);

// ─── Public / optional auth ───────────────────────────────────────────────────
router.get("/nearby", optionalAuth, ctrl.getNearby);
router.get("/compare", optionalAuth, ctrl.compare);
router.get("/search", optionalAuth, ctrl.search);
router.get("/:id", optionalAuth, ctrl.getOne);

// ─── Mess owner ───────────────────────────────────────────────────────────────
router.get(
  "/my/messes",
  protect,
  authorize("mess_owner", "admin"),
  ctrl.getMyMesses,
);
router.post(
  "/",
  protect,
  authorize("mess_owner"),
  uploadMessImages.array("images", 8),
  ctrl.create,
);
router.patch(
  "/:id",
  protect,
  authorize("mess_owner", "admin"),
  uploadMessImages.array("images", 8),
  ctrl.update,
);
router.delete(
  "/:id/images",
  protect,
  authorize("mess_owner"),
  ctrl.deleteImage,
);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get("/", protect, authorize("admin"), ctrl.getAll);
router.patch("/:id/approve", protect, authorize("admin"), ctrl.approve);
router.delete("/:id", protect, authorize("mess_owner", "admin"), ctrl.remove);

module.exports = router;
