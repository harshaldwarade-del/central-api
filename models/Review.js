const mongoose = require("mongoose");
const Mess = require("./Mess");
const {
  Schema,
  model,
  Types: { ObjectId },
} = mongoose;

const ReviewSchema = new Schema(
  {
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
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: [600, "Review cannot exceed 600 characters"],
    },
    images: [{ type: String }],
    tags: [
      {
        type: String,
        enum: ["hygiene", "taste", "value", "service", "quantity", "variety"],
      },
    ],
    likes: [{ type: ObjectId, ref: "User" }],
    // Verified = student actually redeemed a discount code at this mess
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─── Compound index: one review per student per mess ─────────────────────────
ReviewSchema.index({ mess: 1, student: 1 }, { unique: true });
ReviewSchema.index({ mess: 1, createdAt: -1 });
ReviewSchema.index({ mess: 1, rating: -1 });

// ─── Post-save hook: sync avgRating + totalReviews on Mess ───────────────────
const syncRating = async (messId) => {
  const stats = await mongoose.model("Review").aggregate([
    { $match: { mess: messId } },
    {
      $group: {
        _id: "$mess",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  await Mess.findByIdAndUpdate(messId, {
    avgRating: stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : 0,
    totalReviews: stats[0]?.totalReviews ?? 0,
  });
};

ReviewSchema.post("save", async function () {
  await syncRating(this.mess);
});
ReviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) await syncRating(doc.mess);
});

module.exports = model("Review", ReviewSchema);
