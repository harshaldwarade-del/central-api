const Mess = require("../models/Mess");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { sendResponse } = require("../utils/apiResponse");
const {
  getNearbyMesses,
  compareMesses,
  searchMesses,
} = require("../services/geo.service");

// ─── GET /api/mess/nearby ─────────────────────────────────────────────────────
exports.getNearby = asyncHandler(async (req, res) => {
  const { lat, lng, radius, sort, category, minRating, maxPrice, page, limit } =
    req.query;

  if (!lat || !lng)
    throw new ApiError(400, "lat and lng query parameters are required.");

  const result = await getNearbyMesses({
    lat,
    lng,
    radiusKm: radius || 5,
    sort: sort || "rating",
    category,
    minRating,
    maxPrice,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
  });

  return sendResponse(res, 200, result, "Nearby messes fetched");
});

// ─── GET /api/mess/compare?ids=a,b,c ─────────────────────────────────────────
exports.compare = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  if (!ids) throw new ApiError(400, "ids query parameter is required.");

  const idList = ids
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (idList.length < 2)
    throw new ApiError(400, "Provide at least 2 mess ids to compare.");
  if (idList.length > 5)
    throw new ApiError(400, "Cannot compare more than 5 messes at once.");

  const result = await compareMesses(idList);
  return sendResponse(res, 200, { messes: result });
});

// ─── GET /api/mess/search?q=keyword ──────────────────────────────────────────
exports.search = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  if (!q || q.trim().length < 2)
    throw new ApiError(400, "Query must be at least 2 characters.");

  const result = await searchMesses({
    query: q,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
  });
  return sendResponse(res, 200, result);
});

// ─── GET /api/mess/:id ────────────────────────────────────────────────────────
exports.getOne = asyncHandler(async (req, res) => {
  const mess = await Mess.findOne({
    _id: req.params.id,
    isApproved: true,
    isActive: true,
  }).populate("owner", "name phone avatar");

  if (!mess) throw new ApiError(404, "Mess not found.");
  return sendResponse(res, 200, { mess });
});

// ─── POST /api/mess  [mess_owner] ────────────────────────────────────────────
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    address,
    coordinates,
    category,
    timings,
    daysOpen,
    capacity,
    amenities,
    tags,
    phone,
    website,
  } = req.body;

  if (!coordinates?.length === 2)
    throw new ApiError(400, "coordinates [lng, lat] are required.");

  const images = req.files?.map((f) => f.path) || [];

  const mess = await Mess.create({
    owner: req.user._id,
    name,
    description,
    address,
    location: { type: "Point", coordinates },
    category,
    timings,
    daysOpen,
    capacity,
    amenities,
    tags,
    phone,
    website,
    images,
  });

  return sendResponse(
    res,
    201,
    { mess },
    "Mess registered. Pending admin approval.",
  );
});

// ─── PATCH /api/mess/:id  [mess_owner] ───────────────────────────────────────
exports.update = asyncHandler(async (req, res) => {
  const allowed = [
    "name",
    "description",
    "address",
    "category",
    "timings",
    "daysOpen",
    "capacity",
    "amenities",
    "tags",
    "phone",
    "website",
  ];

  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  if (req.body.coordinates) {
    updates.location = { type: "Point", coordinates: req.body.coordinates };
  }

  if (req.files?.length) {
    const newImages = req.files.map((f) => f.path);
    updates.$push = { images: { $each: newImages } };
  }

  const mess = await Mess.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    updates,
    { new: true, runValidators: true },
  );

  if (!mess) throw new ApiError(404, "Mess not found or you do not own it.");
  return sendResponse(res, 200, { mess }, "Mess updated");
});

// ─── DELETE /api/mess/:id  [mess_owner | admin] ───────────────────────────────
exports.remove = asyncHandler(async (req, res) => {
  const filter =
    req.user.role === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, owner: req.user._id };

  const mess = await Mess.findOneAndDelete(filter);
  if (!mess) throw new ApiError(404, "Mess not found or you do not own it.");
  return sendResponse(res, 200, null, "Mess deleted");
});

// ─── PATCH /api/mess/:id/approve  [admin] ────────────────────────────────────
exports.approve = asyncHandler(async (req, res) => {
  const { approve, note } = req.body;

  const mess = await Mess.findByIdAndUpdate(
    req.params.id,
    {
      isApproved: !!approve,
      rejectionNote: approve ? "" : note || "Rejected by admin",
    },
    { new: true },
  );

  if (!mess) throw new ApiError(404, "Mess not found.");
  const msg = approve ? "Mess approved" : "Mess rejected";
  return sendResponse(res, 200, { mess }, msg);
});

// ─── GET /api/mess/my  [mess_owner] ──────────────────────────────────────────
exports.getMyMesses = asyncHandler(async (req, res) => {
  const messes = await Mess.find({ owner: req.user._id }).sort({
    createdAt: -1,
  });
  return sendResponse(res, 200, { messes });
});

// ─── GET /api/mess  [admin] ──────────────────────────────────────────────────
exports.getAll = asyncHandler(async (req, res) => {
  const { isApproved, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (isApproved !== undefined) filter.isApproved = isApproved === "true";

  const skip = (page - 1) * limit;
  const [messes, total] = await Promise.all([
    Mess.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(+limit)
      .populate("owner", "name email"),
    Mess.countDocuments(filter),
  ]);

  return sendResponse(res, 200, {
    messes,
    total,
    page: +page,
    pages: Math.ceil(total / limit),
  });
});

// ─── DELETE image from a mess  [mess_owner] ──────────────────────────────────
exports.deleteImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;
  const mess = await Mess.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    { $pull: { images: imageUrl } },
    { new: true },
  );
  if (!mess) throw new ApiError(404, "Mess not found.");
  return sendResponse(res, 200, { mess }, "Image removed");
});
