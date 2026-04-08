const router = require("express").Router({ mergeParams: true });
const ctrl = require("../controllers/review.controller");
const { protect, optionalAuth } = require("../middleware/auth");
const { authorize } = require("../middleware/role");
const { uploadReviewImage } = require("../config/cloudinary");

// Public
router.get("/:messId/reviews", optionalAuth, ctrl.getReviews);

// Student: my reviews
router.get("/my/reviews", protect, authorize("student"), ctrl.getMyReviews);

// Student: add review
router.post(
  "/:messId/reviews",
  protect,
  authorize("student"),
  uploadReviewImage.array("images", 4),
  ctrl.addReview,
);

// Student | Admin: delete review
router.delete(
  "/reviews/:id",
  protect,
  authorize("student", "admin"),
  ctrl.deleteReview,
);

// Student: like / unlike
router.post(
  "/reviews/:id/like",
  protect,
  authorize("student"),
  ctrl.toggleLike,
);

module.exports = router;
