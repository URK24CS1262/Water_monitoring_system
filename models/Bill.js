
const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    billingMonth: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/
    },
    totalLiters: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    categoryBreakdown: [
      {
        category: String,
        liters: Number
      }
    ],
    tariffBreakdown: [
      {
        slab: String,
        liters: Number,
        rate: Number,
        amount: Number
      }
    ],
    recordCount: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

billSchema.index(
  { userId: 1, billingMonth: 1 },
  { unique: true }
);

module.exports = mongoose.model("Bill", billSchema);
