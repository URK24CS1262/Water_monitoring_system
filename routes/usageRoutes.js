
const express = require("express");
const mongoose = require("mongoose");
const Usage = require("../models/Usage");

const router = express.Router();

// Get all water usage records
router.get("/", async (req, res) => {
  try {
    const usages = await Usage.find().sort({ createdAt: -1 });
    res.json(usages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch water usage." });
  }
});

// Add a water usage record
router.post("/", async (req, res) => {
  try {
    const { date, category, liters } = req.body;

    if (!date || !category || liters === undefined || liters === "") {
      return res.status(400).json({
        message: "Please provide date, category, and liters."
      });
    }

    const amount = Number(liters);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Liters must be a number greater than zero."
      });
    }

    const usage = await Usage.create({
      date,
      category,
      liters: amount
    });

    res.status(201).json(usage);
  } catch (error) {
    res.status(400).json({
      message: error.message || "Failed to add water usage."
    });
  }
});

// Delete a water usage record
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid usage ID." });
    }

    const usage = await Usage.findByIdAndDelete(req.params.id);

    if (!usage) {
      return res.status(404).json({ message: "Usage record not found." });
    }

    res.json({ message: "Usage record deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete water usage." });
  }
});

module.exports = router;
