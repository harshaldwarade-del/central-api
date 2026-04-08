const ApiError = require("../utils/apiError");

const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, _req, res, _next) => {
  let error = err;

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    error = new ApiError(400, `Invalid id: ${err.value}`);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ApiError(409, `${field} already exists.`);
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(400, messages.join(". "));
  }

  // JWT errors (shouldn't reach here normally — caught in auth middleware)
  if (err.name === "JsonWebTokenError") {
    error = new ApiError(401, "Invalid token.");
  }
  if (err.name === "TokenExpiredError") {
    error = new ApiError(401, "Token expired.");
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";

  console.error(
    `[${statusCode}] ${message}`,
    process.env.NODE_ENV === "development" ? err.stack : "",
  );

  res.status(statusCode).json({
    success: false,
    message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
