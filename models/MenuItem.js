const mongoose = require("mongoose");
const Mess = require("./Mess");
const {
  Schema,
  model,
  Types: { ObjectId },
} = mongoose;

const MenuItemSchema = new Schema(
  {
    mess: {
      type: ObjectId,
      ref: "Mess",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [1, "Price must be at least ₹1"],
    },
    category: {
      type: String,
      enum: [
        "breakfast",
        "lunch",
        "dinner",
        "snacks",
        "beverages",
        "thali",
        "special",
      ],
      required: true,
    },
    type: {
      type: String,
      enum: ["veg", "non-veg", "egg"],
      required: true,
    },
    image: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    isSpecial: { type: Boolean, default: false }, // featured / signature dish

    // Nutritional info (optional)
    nutrition: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
    },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
MenuItemSchema.index({ mess: 1, category: 1 });
MenuItemSchema.index({ mess: 1, isAvailable: 1 });

// ─── Post-save hook: recalculate avgPrice on Mess ────────────────────────────
const recalcAvgPrice = async (messId) => {
  const result = await mongoose
    .model("MenuItem")
    .aggregate([
      { $match: { mess: messId, isAvailable: true } },
      { $group: { _id: "$mess", avgPrice: { $avg: "$price" } } },
    ]);
  const avg = result[0]?.avgPrice ?? 0;
  await Mess.findByIdAndUpdate(messId, {
    avgPrice: Math.round(avg * 100) / 100,
  });
};

MenuItemSchema.post("save", async function () {
  await recalcAvgPrice(this.mess);
});
MenuItemSchema.post("findOneAndUpdate", async function (doc) {
  if (doc) await recalcAvgPrice(doc.mess);
});
MenuItemSchema.post("findOneAndDelete", async function (doc) {
  if (doc) await recalcAvgPrice(doc.mess);
});

module.exports = model("MenuItem", MenuItemSchema);
