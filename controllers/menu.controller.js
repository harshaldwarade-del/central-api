const MenuItem = require("../models/MenuItem");
const Mess = require("../models/Mess");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const { sendResponse } = require("../utils/apiResponse");

// ─── Helper: assert caller owns the mess ─────────────────────────────────────
const assertOwnership = async (messId, userId, role) => {
  const mess = await Mess.findById(messId);
  if (!mess) throw new ApiError(404, "Mess not found.");
  if (role !== "admin" && mess.owner.toString() !== userId.toString())
    throw new ApiError(403, "You do not own this mess.");
  return mess;
};

// ─── GET /api/mess/:messId/menu ───────────────────────────────────────────────
exports.getMenu = asyncHandler(async (req, res) => {
  const { category, type, isAvailable } = req.query;
  const filter = { mess: req.params.messId };

  if (category) filter.category = category;
  if (type) filter.type = type;
  if (isAvailable !== undefined) filter.isAvailable = isAvailable === "true";

  const items = await MenuItem.find(filter).sort({ category: 1, price: 1 });

  // Group by category for structured response
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return sendResponse(res, 200, { items, grouped, total: items.length });
});

// ─── POST /api/mess/:messId/menu  [mess_owner] ────────────────────────────────
exports.addItem = asyncHandler(async (req, res) => {
  await assertOwnership(req.params.messId, req.user._id, req.user.role);

  const { name, description, price, category, type, isSpecial, nutrition } =
    req.body;
  const image = req.file?.path || "";

  const item = await MenuItem.create({
    mess: req.params.messId,
    name,
    description,
    price,
    category,
    type,
    isSpecial,
    nutrition,
    image,
  });

  return sendResponse(res, 201, { item }, "Menu item added");
});

// ─── PATCH /api/mess/:messId/menu/:itemId  [mess_owner] ──────────────────────
exports.updateItem = asyncHandler(async (req, res) => {
  await assertOwnership(req.params.messId, req.user._id, req.user.role);

  const allowed = [
    "name",
    "description",
    "price",
    "category",
    "type",
    "isAvailable",
    "isSpecial",
    "nutrition",
  ];
  const updates = {};
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });
  if (req.file) updates.image = req.file.path;

  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.itemId, mess: req.params.messId },
    updates,
    { new: true, runValidators: true },
  );

  if (!item) throw new ApiError(404, "Menu item not found.");
  return sendResponse(res, 200, { item }, "Menu item updated");
});

// ─── DELETE /api/mess/:messId/menu/:itemId  [mess_owner] ─────────────────────
exports.deleteItem = asyncHandler(async (req, res) => {
  await assertOwnership(req.params.messId, req.user._id, req.user.role);

  const item = await MenuItem.findOneAndDelete({
    _id: req.params.itemId,
    mess: req.params.messId,
  });

  if (!item) throw new ApiError(404, "Menu item not found.");
  return sendResponse(res, 200, null, "Menu item deleted");
});

// ─── PATCH /api/mess/:messId/menu/:itemId/toggle  [mess_owner] ───────────────
exports.toggleAvailability = asyncHandler(async (req, res) => {
  await assertOwnership(req.params.messId, req.user._id, req.user.role);

  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    mess: req.params.messId,
  });
  if (!item) throw new ApiError(404, "Menu item not found.");

  item.isAvailable = !item.isAvailable;
  await item.save();

  return sendResponse(
    res,
    200,
    { item },
    `Item marked as ${item.isAvailable ? "available" : "unavailable"}`,
  );
});

// ─── POST /api/mess/:messId/menu/bulk  [mess_owner] — add many items at once ─
exports.bulkAdd = asyncHandler(async (req, res) => {
  await assertOwnership(req.params.messId, req.user._id, req.user.role);

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length)
    throw new ApiError(400, "items array is required.");

  const docs = items.map((item) => ({ ...item, mess: req.params.messId }));
  const created = await MenuItem.insertMany(docs, { ordered: false });

  return sendResponse(
    res,
    201,
    { items: created, count: created.length },
    "Bulk items added",
  );
});
