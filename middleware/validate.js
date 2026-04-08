const { validationResult, body, query, param } = require("express-validator");
const ApiError = require("../utils/apiError");

// Run validations and collect errors
const validate = (validations) => async (req, _res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const messages = errors.array().map((e) => `${e.path}: ${e.msg}`);
  return next(new ApiError(422, messages.join(". ")));
};

// ─── Reusable rule sets ───────────────────────────────────────────────────────

const registerRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("Name must be 2-60 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role")
    .optional()
    .isIn(["student", "mess_owner"])
    .withMessage("Invalid role"),
];

const loginRules = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const createMessRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Mess name is required (2-100 chars)"),
  body("address.city").notEmpty().withMessage("City is required"),
  body("address.state").notEmpty().withMessage("State is required"),
  body("coordinates")
    .isArray({ min: 2, max: 2 })
    .withMessage("coordinates must be [lng, lat]"),
  body("coordinates.*").isFloat().withMessage("Coordinates must be numbers"),
  body("category")
    .isIn(["veg", "non-veg", "both"])
    .withMessage("Invalid category"),
];

const addMenuItemRules = [
  body("name").trim().notEmpty().withMessage("Item name is required"),
  body("price")
    .isFloat({ min: 1 })
    .withMessage("Price must be a positive number"),
  body("category")
    .isIn([
      "breakfast",
      "lunch",
      "dinner",
      "snacks",
      "beverages",
      "thali",
      "special",
    ])
    .withMessage("Invalid category"),
  body("type").isIn(["veg", "non-veg", "egg"]).withMessage("Invalid type"),
];

const addReviewRules = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("comment")
    .optional()
    .isLength({ max: 600 })
    .withMessage("Comment too long"),
];

const createCodeRules = [
  body("discountType")
    .isIn(["percentage", "flat"])
    .withMessage("discountType must be percentage or flat"),
  body("discountValue")
    .isFloat({ min: 1 })
    .withMessage("discountValue must be positive"),
  body("validTill")
    .optional()
    .isISO8601()
    .withMessage("validTill must be a valid date"),
];

const nearbyRules = [
  query("lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  query("lng")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
  query("radius")
    .optional()
    .isFloat({ min: 0.5, max: 50 })
    .withMessage("Radius must be 0.5–50 km"),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  createMessRules,
  addMenuItemRules,
  addReviewRules,
  createCodeRules,
  nearbyRules,
};
