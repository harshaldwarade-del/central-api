const ApiError = require("../utils/apiError");

/**
 * authorize('mess_owner', 'admin')
 * Must be used AFTER protect middleware.
 */
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Role '${req.user.role}' is not allowed to perform this action.`,
        ),
      );
    }
    next();
  };

/**
 * Checks that the authenticated user owns the requested mess.
 * Expects req.mess to be set by a prior middleware or controller step.
 */
const isMessOwner = (req, _res, next) => {
  if (req.user.role === "admin") return next(); // admins bypass
  if (!req.mess) return next(new ApiError(500, "Mess not loaded in request"));

  if (req.mess.owner.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, "You do not own this mess."));
  }
  next();
};

module.exports = { authorize, isMessOwner };
