const mongoose = require("mongoose");
const {
  Schema,
  model,
  Types: { ObjectId },
} = mongoose;

const MessSchema = new Schema(
  {
    owner: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Mess name is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    images: [{ type: String }], // Cloudinary secure URLs
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true, required: true },
      state: { type: String, trim: true, required: true },
      pincode: { type: String, match: [/^\d{6}$/, "Invalid pincode"] },
      landmark: { type: String, trim: true },
    },
    // GeoJSON — mandatory for geo queries
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Coordinates are required"],
      },
    },
    category: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      default: "both",
    },
    timings: {
      open: { type: String, default: "07:00" }, // "HH:MM" 24h
      close: { type: String, default: "22:00" },
    },
    daysOpen: [
      {
        type: String,
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
    ],
    capacity: { type: Number, min: 1 },
    amenities: [{ type: String }], // e.g. 'wifi', 'ac', 'parking', 'takeaway'
    tags: [{ type: String }], // e.g. 'student-friendly', 'thali', 'tiffin'

    // Admin approval flow
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    rejectionNote: { type: String },

    // Denormalized fields — updated via hooks for fast geo queries
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    avgPrice: { type: Number, default: 0 }, // average of all menu item prices

    // Contact
    phone: { type: String },
    website: { type: String },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
MessSchema.index({ location: "2dsphere" });
MessSchema.index({ isApproved: 1, isActive: 1 });
MessSchema.index({ avgRating: -1, avgPrice: 1 });
MessSchema.index({ name: "text", description: "text", tags: "text" });

// ─── Virtual: full address string ────────────────────────────────────────────
MessSchema.virtual("fullAddress").get(function () {
  const a = this.address;
  return [a.street, a.landmark, a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(", ");
});

MessSchema.set("toJSON", { virtuals: true });
MessSchema.set("toObject", { virtuals: true });

module.exports = model("Mess", MessSchema);
