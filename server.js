require("./config/env.js");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth.routes");
const messRoutes = require("./routes/mess.routes");
const menuRoutes = require("./routes/menu.routes");
const reviewRoutes = require("./routes/review.routes");
const discountRoutes = require("./routes/discount.routes");

const app = express();

// ─── DB connections ─────────────────────────────────────────────────────────
connectDB();
// connectRedis();

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// ─── Global middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }),
);

// ─── API routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/mess", messRoutes);
app.use("/api/mess", menuRoutes); // /api/mess/:messId/menu
app.use("/api/mess", reviewRoutes); // /api/mess/:messId/reviews
app.use("/api/discount", discountRoutes);

// ─── Error handlers ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Everything's working!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nServer running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
