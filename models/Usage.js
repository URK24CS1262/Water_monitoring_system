
const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Bathing",
        "Cooking",
        "Washing",
        "Cleaning",
        "Gardening",
        "Other"
      ]
    },
    liters: {
      type: Number,
      required: true,
      min: 0.1
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Usage", usageSchema);
