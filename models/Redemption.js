const mongoose = require("mongoose");
const {
  Schema,
  model,
  Types: { ObjectId },
} = mongoose;

const RedemptionSchema = new Schema(
  {
    code: {
      type: ObjectId,
      ref: "DiscountCode",
      required: true,
    },
    mess: {
      type: ObjectId,
      ref: "Mess",
      required: true,
    },
    student: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    // If another student shared the code to this student
    sharedBy: {
      type: ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "expired", "cancelled"],
      default: "pending",
    },
    // Set when mess owner confirms the redemption
    billAmount: { type: Number },
    savings: { type: Number },
    confirmedAt: { type: Date },
    // The actual discount code string (denormalized for quick lookup)
    codeString: { type: String, uppercase: true },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
RedemptionSchema.index({ code: 1, student: 1 });
RedemptionSchema.index({ mess: 1, status: 1 });
RedemptionSchema.index({ student: 1, createdAt: -1 });
RedemptionSchema.index({ sharedBy: 1 }); // for referral analytics

module.exports = model("Redemption", RedemptionSchema);
