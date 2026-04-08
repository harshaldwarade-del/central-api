const mongoose = require("mongoose");
const {
  Schema,
  model,
  Types: { ObjectId },
} = mongoose;

const DiscountCodeSchema = new Schema(
  {
    mess: {
      type: ObjectId,
      ref: "Mess",
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [1, "Discount value must be positive"],
    },
    // Business rules
    maxUses: { type: Number, default: null }, // null = unlimited
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 }, // how many times one user can use it
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null }, // cap for percentage type

    validFrom: { type: Date, default: Date.now },
    validTill: { type: Date }, // null = no expiry

    isActive: { type: Boolean, default: true },
    shareableLink: { type: String }, // deep link
    description: { type: String, maxlength: 200 },

    // Who created it (mess owner user id)
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
DiscountCodeSchema.index({ mess: 1, isActive: 1 });
DiscountCodeSchema.index({ validTill: 1 }, { expireAfterSeconds: 0 }); // TTL auto-expire

// ─── Virtual: is this code currently valid? ───────────────────────────────────
DiscountCodeSchema.virtual("isExpired").get(function () {
  if (!this.validTill) return false;
  return new Date() > this.validTill;
});

DiscountCodeSchema.virtual("isExhausted").get(function () {
  if (this.maxUses === null) return false;
  return this.usedCount >= this.maxUses;
});

DiscountCodeSchema.virtual("isUsable").get(function () {
  return this.isActive && !this.isExpired && !this.isExhausted;
});

DiscountCodeSchema.set("toJSON", { virtuals: true });
DiscountCodeSchema.set("toObject", { virtuals: true });

module.exports = model("DiscountCode", DiscountCodeSchema);
