
const $ = (id) => document.getElementById(id);

const usageForm = $("usageForm");
const usageMessage = $("usageMessage");
const historyBody = $("historyBody");
const logoutBtn = $("logoutBtn");

const billMonthInput = $("billMonth");
const generateBillBtn = $("generateBillBtn");
const billMessage = $("billMessage");
const billResult = $("billResult");
const savedBillsBody = $("savedBillsBody");
const printBillBtn = $("printBillBtn");

let records = [];
let savedBills = [];
let currentBill = null;

let weeklyChart;
let categoryChart;
let trendChart;

const RATE_PER_KILOLITRE = 10;

const palette = [
  "#13b8a6", "#56b4e9", "#f4b860",
  "#9a82db", "#f17c8e", "#6d91b5"
];

// MESSAGES
function showMessage(message, success = false) {
  if (!usageMessage) return;
  usageMessage.textContent = message;
  usageMessage.classList.toggle("success", success);
}

function showBillMessage(message, success = false) {
  if (!billMessage) return;
  billMessage.textContent = message;
  billMessage.classList.toggle("success", success);
}

// API
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  if (response.status === 401) {
    window.location.replace("/");
    throw new Error("Please sign in again.");
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const message = await response.text();
    console.error(`API error: ${url}`, response.status, message);
    throw new Error(`Server error ${response.status} for ${url}.`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

// DATE HELPERS
function dateKey(value) {
  if (!value) return "";

  // Avoid timezone shifts for YYYY-MM-DD values.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function localDateString(date = new Date()) {
  return dateKey(date);
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDate(value) {
  const key = dateKey(value);
  if (!key) return "—";

  const date = new Date(`${key}T12:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function liters(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function formatRupees(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

// DASHBOARD SUMMARY
function updateSummary() {
  const today = localDateString();
  const month = today.slice(0, 7);

  const todayTotal = records
    .filter((record) => dateKey(record.date) === today)
    .reduce((sum, record) => sum + Number(record.liters || 0), 0);

  const monthTotal = records
    .filter((record) => dateKey(record.date).startsWith(month))
    .reduce((sum, record) => sum + Number(record.liters || 0), 0);

  const weekStart = localDateString(addDays(startOfDay(), -6));

  const weekTotal = records
    .filter((record) => {
      const date = dateKey(record.date);
      return date >= weekStart && date <= today;
    })
    .reduce((sum, record) => sum + Number(record.liters || 0), 0);

  if ($("todayUsage")) $("todayUsage").textContent = liters(todayTotal);
  if ($("monthUsage")) $("monthUsage").textContent = liters(monthTotal);
  if ($("averageUsage")) $("averageUsage").textContent = liters(weekTotal / 7);

  if ($("remainingUsage")) {
    $("remainingUsage").textContent = liters(Math.max(0, 200 - todayTotal));
  }
}

// CHART OPTIONS
function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 16
        }
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label || context.label}: ${liters(
              context.parsed.y ?? context.parsed
            )} L`
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true }
    }
  };
}

// CHARTS
function renderCharts() {
  if (typeof Chart === "undefined") return;

  const today = startOfDay();
  const labels = [];
  const dailyValues = [];

  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const key = dateKey(day);

    labels.push(day.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric"
    }));

    dailyValues.push(
      records.reduce((sum, record) => {
        return dateKey(record.date) === key
          ? sum + Number(record.liters || 0)
          : sum;
      }, 0)
    );
  }

  if ($("weeklyChart")) {
    if (weeklyChart) weeklyChart.destroy();

    weeklyChart = new Chart($("weeklyChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Water used",
          data: dailyValues,
          backgroundColor: dailyValues.map((_, index) =>
            index === 6 ? "#13b8a6" : "rgba(86,180,233,0.72)"
          ),
          borderRadius: 7
        }]
      },
      options: chartOptions()
    });
  }

  const totals = {};

  records.forEach((record) => {
    const category = record.category || "Other";
    totals[category] =
      (totals[category] || 0) + Number(record.liters || 0);
  });

  const categoryNames = Object.keys(totals);

  if ($("categoryChart")) {
    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart($("categoryChart"), {
      type: "doughnut",
      data: {
        labels: categoryNames.length ? categoryNames : ["No records yet"],
        datasets: [{
          data: categoryNames.length
            ? categoryNames.map((name) => totals[name])
            : [1],
          backgroundColor: categoryNames.length
            ? categoryNames.map((_, index) => palette[index % palette.length])
            : ["#e5edf4"],
          borderWidth: 3,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: "68%"
      }
    });
  }

  if ($("trendChart")) {
    if (trendChart) trendChart.destroy();

    trendChart = new Chart($("trendChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Daily consumption",
          data: dailyValues,
          borderColor: "#13b8a6",
          backgroundColor: "rgba(19,184,166,0.13)",
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#13b8a6",
          borderWidth: 3,
          tension: 0.4,
          fill: true
        }]
      },
      options: chartOptions()
    });
  }
}

// USAGE HISTORY
function renderHistory() {
  if (!historyBody) return;

  historyBody.replaceChildren();

  if (!records.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No usage records found.";
    row.appendChild(cell);
    historyBody.appendChild(row);
    return;
  }

  records.slice(0, 50).forEach((record) => {
    const row = document.createElement("tr");

    function createCell(value) {
      const cell = document.createElement("td");
      cell.textContent = value;
      return cell;
    }

    row.appendChild(createCell(formatDate(record.date)));
    row.appendChild(createCell(record.category || "Other"));
    row.appendChild(createCell(`${liters(record.liters)} L`));
    row.appendChild(createCell(record.description || "—"));

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete this water usage record?")) return;

      deleteButton.disabled = true;

      try {
        await api(`/api/usages/${encodeURIComponent(record._id)}`, {
          method: "DELETE"
        });

        await loadRecords();
        showMessage("Record deleted successfully.", true);
      } catch (error) {
        showMessage(error.message);
        deleteButton.disabled = false;
      }
    });

    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    historyBody.appendChild(row);
  });
}

// LOAD RECORDS: DISPLAY HISTORY BEFORE CHARTS
async function loadRecords() {
  const result = await api("/api/usages");

  records = Array.isArray(result)
    ? result
    : Array.isArray(result.usages)
      ? result.usages
      : [];

  updateSummary();
  renderHistory();

  requestAnimationFrame(() => {
    renderCharts();
  });
}

// CALCULATE MONTHLY BILL
function calculateBill(billingMonth) {
  const monthlyRecords = records.filter((record) =>
    dateKey(record.date).startsWith(billingMonth)
  );

  const totalLiters = monthlyRecords.reduce(
    (sum, record) => sum + Number(record.liters || 0),
    0
  );

  return {
    billingMonth,
    totalLiters,
    totalAmount: (totalLiters / 1000) * RATE_PER_KILOLITRE,
    recordCount: monthlyRecords.length
  };
}

// DISPLAY BILLS
function renderSavedBills() {
  if (!savedBillsBody) return;

  savedBillsBody.replaceChildren();

  if (!savedBills.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "No bills generated in this session.";
    row.appendChild(cell);
    savedBillsBody.appendChild(row);
    return;
  }

  savedBills.forEach((bill) => {
    const row = document.createElement("tr");

    [
      bill.billingMonth,
      `${liters(bill.totalLiters)} L`,
      formatRupees(bill.totalAmount)
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    savedBillsBody.appendChild(row);
  });
}

// GENERATE BILL
if (generateBillBtn) {
  generateBillBtn.addEventListener("click", () => {
    const month = billMonthInput?.value;

    if (!month) {
      showBillMessage("Please select a billing month.");
      return;
    }

    currentBill = calculateBill(month);

    if ($("billMonthText")) {
      $("billMonthText").textContent = currentBill.billingMonth;
    }

    if ($("billLiters")) {
      $("billLiters").textContent =
        `${liters(currentBill.totalLiters)} L`;
    }

    if ($("billAmount")) {
      $("billAmount").textContent =
        formatRupees(currentBill.totalAmount);
    }

    if (billResult) billResult.hidden = false;

    savedBills = [
      currentBill,
      ...savedBills.filter(
        (bill) => bill.billingMonth !== currentBill.billingMonth
      )
    ];

    renderSavedBills();

    showBillMessage(
      currentBill.recordCount
        ? "Bill calculated. Click Download PDF."
        : "No usage records found for this month. Bill amount is ₹0.00.",
      true
    );
  });
}

// DOWNLOAD PDF
if (printBillBtn) {
  printBillBtn.addEventListener("click", () => {
    if (!currentBill) {
      showBillMessage("Generate a bill first.");
      return;
    }

    if (!window.jspdf) {
      showBillMessage("PDF library unavailable. Check your internet connection.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(23);
    pdf.text("AquaTrack", 20, 25);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text("Water Usage Monitoring Portal", 20, 34);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("Monthly Water Bill", 20, 50);

    pdf.setDrawColor(19, 184, 166);
    pdf.line(20, 56, 190, 56);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(`Billing Month: ${currentBill.billingMonth}`, 20, 72);
    pdf.text(
      `Total Water Usage: ${liters(currentBill.totalLiters)} litres`,
      20,
      86
    );
    pdf.text(`Usage Records: ${currentBill.recordCount}`, 20, 100);
    pdf.text("Demo tariff: Rs. 10 per 1,000 litres", 20, 114);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(
      `Total Amount: Rs. ${currentBill.totalAmount.toFixed(2)}`,
      20,
      132
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Estimated project bill, not an official utility bill.", 20, 148);
    pdf.text("Generated by AquaTrack", 20, 158);

    pdf.save(`AquaTrack-Bill-${currentBill.billingMonth}.pdf`);
  });
}

// DEFAULT BILLING MONTH
if (billMonthInput) {
  const month = localDateString().slice(0, 7);
  billMonthInput.max = month;

  if (!billMonthInput.value) {
    billMonthInput.value = month;
  }
}

// ADD WATER USAGE
if (usageForm) {
  usageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const litersValue = Number($("liters").value);

    if (!Number.isFinite(litersValue) || litersValue <= 0) {
      showMessage("Enter a valid water usage amount.");
      return;
    }

    const saveButton = usageForm.querySelector('button[type="submit"]');
    if (saveButton) saveButton.disabled = true;

    try {
      await api("/api/usages", {
        method: "POST",
        body: JSON.stringify({
          category: $("category").value,
          liters: litersValue,
          date: $("usageDate").value,
          description: $("description").value.trim()
        })
      });

      $("liters").value = "";
      $("description").value = "";

      await loadRecords();
      showMessage("Water usage saved successfully.", true);
    } catch (error) {
      showMessage(error.message);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

// REFRESH HISTORY
if ($("refreshBtn")) {
  $("refreshBtn").addEventListener("click", async () => {
    try {
      await loadRecords();
      showMessage("Records refreshed.", true);
    } catch (error) {
      showMessage(error.message);
    }
  });
}

// LOGOUT
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;

    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace("/");
    } catch (error) {
      showMessage(error.message);
      logoutBtn.disabled = false;
    }
  });
}

// MOBILE SIDEBAR
if ($("menuBtn") && $("sidebar")) {
  $("menuBtn").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });
}

// SIDEBAR NAVIGATION
document.querySelectorAll(".nav-link[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link[href^='#']").forEach((item) => {
      item.classList.remove("active");
    });

    link.classList.add("active");
    $("sidebar")?.classList.remove("open");
  });
});

// INITIALIZE
async function initializeDashboard() {
  try {
    const result = await api("/api/auth/me");
    const user = result.user || result;

    if ($("profileName")) {
      $("profileName").textContent = user.name || "User";
    }

    if ($("welcomeTitle")) {
      $("welcomeTitle").textContent =
        `Welcome back, ${(user.name || "User").split(" ")[0]}`;
    }

    if ($("usageDate")) {
      $("usageDate").value = localDateString();
      $("usageDate").max = localDateString();
    }

    await loadRecords();
    renderSavedBills();
  } catch (error) {
    console.error("Dashboard initialization error:", error);
    showMessage(error.message);
    showBillMessage(error.message);
  }
}

initializeDashboard();
