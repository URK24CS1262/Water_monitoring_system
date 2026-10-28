
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const path = require("path");

const User = require("./models/User");
const Usage = require("./models/Usage");
const Bill = require("./models/Bill");

const app = express();
const PORT = process.env.PORT || 3000;
const BILL_RATE_PER_KL = 10;

// ===============================
// MIDDLEWARE
// ===============================

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// ===============================
// AUTHENTICATION MIDDLEWARE
// ===============================

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      message: "Please sign in first."
    });
  }

  next();
}

// ===============================
// HOME PAGE
// ===============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// PROTECTED DASHBOARD
// ===============================

app.get("/dashboard.html", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/");
  }

  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Serve other public files, such as CSS and JavaScript.
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// SIGN UP
// ===============================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Please enter all required details."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Password must contain 8 to 72 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword
    });

    req.session.userId = user._id.toString();

    req.session.save((error) => {
      if (error) {
        console.error("Signup session error:", error);

        return res.status(500).json({
          message: "Account created, but unable to start your session. Please log in."
        });
      }

      res.status(201).json({
        message: "Account created successfully.",
        name: user.name
      });
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered."
      });
    }

    res.status(500).json({
      message: "Unable to create account."
    });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Please enter email and password."
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration error:", error);

        return res.status(500).json({
          message: "Unable to create login session."
        });
      }

      req.session.userId = user._id.toString();

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);

          return res.status(500).json({
            message: "Unable to save login session."
          });
        }

        res.json({
          message: "Login successful.",
          name: user.name
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Unable to log in."
    });
  }
});

// ===============================
// GET CURRENT USER
// ===============================

app.get("/api/auth/me", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId)
      .select("name email");

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "User not found. Please sign in again."
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Current user error:", error);

    res.status(500).json({
      message: "Unable to load user details."
    });
  }
});

// ===============================
// LOGOUT
// ===============================

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);

      return res.status(500).json({
        message: "Unable to log out."
      });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });

    res.json({
      message: "Logged out successfully."
    });
  });
});

// ===============================
// ADD WATER USAGE
// ===============================

app.post("/api/usages", requireLogin, async (req, res) => {
  try {
    const { category, liters, date, description } = req.body;
    const amount = Number(liters);

    const allowedCategories = [
      "Bathing",
      "Cooking",
      "Washing",
      "Cleaning",
      "Gardening",
      "Other"
    ];

    if (
      !allowedCategories.includes(category) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000
    ) {
      return res.status(400).json({
        message: "Please enter valid water usage details."
      });
    }

    let usageDate;

    if (date) {
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      ) {
        return res.status(400).json({
          message: "Please select a valid date."
        });
      }

      usageDate = new Date(`${date}T00:00:00`);
    } else {
      usageDate = new Date();
    }

    if (Number.isNaN(usageDate.getTime())) {
      return res.status(400).json({
        message: "Please select a valid date."
      });
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (usageDate > today) {
      return res.status(400).json({
        message: "Usage date cannot be in the future."
      });
    }

    const usage = await Usage.create({
      userId: req.session.userId,
      category,
      liters: amount,
      date: usageDate,
      description:
        typeof description === "string"
          ? description.trim().slice(0, 200)
          : ""
    });

    res.status(201).json({
      message: "Water usage saved successfully.",
      usage
    });
  } catch (error) {
    console.error("Add usage error:", error);

    res.status(500).json({
      message: "Unable to save water usage."
    });
  }
});

// ===============================
// GET WATER USAGE HISTORY
// ===============================

app.get("/api/usages", requireLogin, async (req, res) => {
  try {
    const usages = await Usage.find({
      userId: req.session.userId
    }).sort({
      date: -1,
      createdAt: -1
    });

    res.json(usages);
  } catch (error) {
    console.error("Get usages error:", error);

    res.status(500).json({
      message: "Unable to load water usage."
    });
  }
});

// ===============================
// DELETE WATER USAGE
// ===============================

app.delete("/api/usages/:id", requireLogin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid usage record ID."
      });
    }

    const deletedUsage = await Usage.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!deletedUsage) {
      return res.status(404).json({
        message: "Usage record not found."
      });
    }

    res.json({
      message: "Usage record deleted successfully."
    });
  } catch (error) {
    console.error("Delete usage error:", error);

    res.status(500).json({
      message: "Unable to delete usage record."
    });
  }
});

// ===============================
// GENERATE AND SAVE MONTHLY BILL
// ===============================

app.post("/api/bills/generate", requireLogin, async (req, res) => {
  try {
    const { billingMonth } = req.body;

    if (
      typeof billingMonth !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)
    ) {
      return res.status(400).json({
        message: "Please select a valid billing month."
      });
    }

    const [year, month] = billingMonth.split("-").map(Number);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const usages = await Usage.find({
      userId: req.session.userId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    });

    const totalLiters = usages.reduce(
      (sum, usage) => sum + Number(usage.liters || 0),
      0
    );

    const totalAmount =
      Math.round(
        (totalLiters / 1000) * BILL_RATE_PER_KL * 100
      ) / 100;

    const categoryTotals = {};

    usages.forEach((usage) => {
      const category = usage.category || "Other";

      categoryTotals[category] =
        (categoryTotals[category] || 0) +
        Number(usage.liters || 0);
    });

    const categoryBreakdown = Object.entries(categoryTotals).map(
      ([category, liters]) => ({
        category,
        liters
      })
    );

    const tariffBreakdown = [
      {
        slab: "Demo rate",
        liters: totalLiters,
        rate: BILL_RATE_PER_KL,
        amount: totalAmount
      }
    ];

    const bill = await Bill.findOneAndUpdate(
      {
        userId: req.session.userId,
        billingMonth
      },
      {
        $set: {
          totalLiters,
          totalAmount,
          categoryBreakdown,
          tariffBreakdown,
          recordCount: usages.length
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log(
      `Bill saved: ${billingMonth}, ${totalLiters} litres`
    );

    res.status(200).json({
      message: "Bill generated and saved successfully.",
      bill
    });
  } catch (error) {
    console.error("Bill generation error:", error);

    res.status(500).json({
      message: "Unable to generate bill. Check the server logs."
    });
  }
});

// ===============================
// GET SAVED BILLS
// ===============================

app.get("/api/bills", requireLogin, async (req, res) => {
  try {
    const bills = await Bill.find({
      userId: req.session.userId
    }).sort({
      billingMonth: -1
    });

    res.json(bills);
  } catch (error) {
    console.error("Get bills error:", error);

    res.status(500).json({
      message: "Unable to load saved bills."
    });
  }
});

// ===============================
// UNKNOWN API ROUTES
// ===============================

app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// ===============================
// START SERVER
// ===============================

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from Render environment variables.");
  }

  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from Render environment variables.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("MongoDB connected successfully.");

  app.listen(PORT, () => {
    console.log(`AquaTrack server listening on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
