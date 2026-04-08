const Review = require("../models/Review");
const Mess = require("../models/Mess");
const Redemption = require("../models/Redemption");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { sendResponse } = require("../utils/apiResponse");

// ─── GET /api/mess/:messId/reviews ───────────────────────────────────────────
exports.getReviews = asyncHandler(async (req, res) => {
  const { sort = "recent", page = 1, limit = 10, rating } = req.query;

  const SORT_MAP = {
    recent: { createdAt: -1 },
    rating_asc: { rating: 1 },
    rating_desc: { rating: -1 },
    helpful: { likes: -1 },
  };

  const filter = { mess: req.params.messId };
  if (rating) filter.rating = parseInt(rating);

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort(SORT_MAP[sort] || SORT_MAP.recent)
      .skip(skip)
      .limit(+limit)
      .populate("student", "name avatar college")
      .lean(),
    Review.countDocuments(filter),
  ]);

  // Rating distribution
  const distribution = await Review.aggregate([
    {
      $match: {
        mess: require("mongoose").Types.ObjectId.createFromHexString(
          req.params.messId,
        ),
      },
    },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  return sendResponse(res, 200, {
    reviews,
    total,
    page: +page,
    pages: Math.ceil(total / +limit),
    distribution,
  });
});

// ─── POST /api/mess/:messId/reviews  [student] ───────────────────────────────
exports.addReview = asyncHandler(async (req, res) => {
  const messId = req.params.messId;

  const mess = await Mess.findOne({ _id: messId, isApproved: true });
  if (!mess) throw new ApiError(404, "Mess not found.");

  const existing = await Review.findOne({
    mess: messId,
    student: req.user._id,
  });
  if (existing) throw new ApiError(409, "You have already reviewed this mess.");

  const { rating, comment, tags } = req.body;
  const images = req.files?.map((f) => f.path) || [];

  // Check if student has a confirmed redemption at this mess — mark as verified
  const redeemed = await Redemption.exists({
    mess: messId,
    student: req.user._id,
    status: "confirmed",
  });

  const review = await Review.create({
    mess: messId,
    student: req.user._id,
    rating,
    comment,
    tags,
    images,
    isVerified: !!redeemed,
  });

  const populated = await review.populate("student", "name avatar college");
  return sendResponse(res, 201, { review: populated }, "Review added");
});

// ─── DELETE /api/reviews/:id  [student | admin] ───────────────────────────────
exports.deleteReview = asyncHandler(async (req, res) => {
  const filter =
    req.user.role === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, student: req.user._id };

  const review = await Review.findOneAndDelete(filter);
  if (!review)
    throw new ApiError(404, "Review not found or you did not write it.");
  return sendResponse(res, 200, null, "Review deleted");
});

// ─── POST /api/reviews/:id/like  [student] ────────────────────────────────────
exports.toggleLike = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, "Review not found.");

  const userId = req.user._id;
  const liked = review.likes.some((id) => id.equals(userId));

  if (liked) {
    review.likes.pull(userId);
  } else {
    review.likes.push(userId);
  }

  await review.save({ validateBeforeSave: false });
  return sendResponse(res, 200, { likes: review.likes.length, liked: !liked });
});

// ─── GET /api/reviews/my  [student] ──────────────────────────────────────────
exports.getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ student: req.user._id })
    .sort({ createdAt: -1 })
    .populate("mess", "name images address avgRating");
  return sendResponse(res, 200, { reviews });
});
