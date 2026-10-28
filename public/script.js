
const form = document.getElementById("usageForm");
const dateInput = document.getElementById("date");
const categoryInput = document.getElementById("category");
const litersInput = document.getElementById("liters");
const submitBtn = document.getElementById("submitBtn");
const message = document.getElementById("message");
const usageTable = document.getElementById("usageTable");

const todayUsage = document.getElementById("todayUsage");
const monthlyUsage = document.getElementById("monthlyUsage");
const averageUsage = document.getElementById("averageUsage");
const remainingUsage = document.getElementById("remainingUsage");

const DAILY_LIMIT = 200;
const categories = [
  "Drinking", "Bathing", "Cooking", "Washing",
  "Cleaning", "Gardening", "Other"
];

const chartColors = [
  "#3678f5", "#8c60d8", "#f3a447", "#25b889",
  "#ed7189", "#40b9ca", "#8795a9"
];

let weeklyChart;
let categoryChart;
let trendChart;

dateInput.value = getLocalDate();

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffset(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getLocalDate(date);
}

function formatLiters(value) {
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = type;
}

async function loadUsages() {
  try {
    const response = await fetch("/api/usages");

    if (!response.ok) {
      throw new Error("Unable to fetch records from the server.");
    }

    const usages = await response.json();

    renderTable(usages);
    updateDashboard(usages);
    updateCharts(usages);
  } catch (error) {
    usageTable.innerHTML = `
      <tr><td colspan="4" class="empty-state">
        Could not load records. Check the server and database connection.
      </td></tr>`;

    showMessage(error.message, "error");
  }
}

function updateDashboard(usages) {
  const today = getLocalDate();
  const currentMonth = today.slice(0, 7);

  const todayTotal = usages
    .filter(item => item.date === today)
    .reduce((sum, item) => sum + Number(item.liters), 0);

  const monthTotal = usages
    .filter(item => item.date.startsWith(currentMonth))
    .reduce((sum, item) => sum + Number(item.liters), 0);

  const lastSevenDates = Array.from(
    { length: 7 },
    (_, index) => dateOffset(6 - index)
  );

  const lastSevenTotal = usages
    .filter(item => lastSevenDates.includes(item.date))
    .reduce((sum, item) => sum + Number(item.liters), 0);

  const average = lastSevenTotal / 7;
  const remaining = DAILY_LIMIT - todayTotal;
  const percentage = (todayTotal / DAILY_LIMIT) * 100;

  todayUsage.textContent = formatLiters(todayTotal);
  monthlyUsage.textContent = formatLiters(monthTotal);
  averageUsage.textContent = formatLiters(average);
  remainingUsage.textContent = formatLiters(Math.max(0, remaining));

  document.getElementById("limitPercent").textContent =
    formatLiters(percentage);

  document.getElementById("limitProgress").style.width =
    `${Math.min(percentage, 100)}%`;

  document.getElementById("limitProgress").style.background =
    percentage > 100 ? "#e05260" : "#3678f5";

  document.getElementById("limitTitle").textContent =
    percentage > 100 ? "Daily target exceeded" :
    percentage >= 80 ? "Approaching your daily target" :
    "You're on track";

  document.getElementById("limitDescription").textContent =
    `${formatLiters(todayTotal)} L used out of ${DAILY_LIMIT} L today.`;
}

function updateCharts(usages) {
  const dates = Array.from(
    { length: 7 },
    (_, index) => dateOffset(6 - index)
  );

  const dailyTotals = dates.map(date =>
    usages
      .filter(item => item.date === date)
      .reduce((sum, item) => sum + Number(item.liters), 0)
  );

  const labels = dates.map(date =>
    new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short"
    })
  );

  const currentMonth = getLocalDate().slice(0, 7);
  const monthUsages = usages.filter(item =>
    item.date.startsWith(currentMonth)
  );

  const categoryTotals = categories.map(category =>
    monthUsages
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + Number(item.liters), 0)
  );

  if (weeklyChart) weeklyChart.destroy();
  if (categoryChart) categoryChart.destroy();
  if (trendChart) trendChart.destroy();

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: context => `${formatLiters(context.parsed.y ?? context.parsed)} L`
        }
      }
    }
  };

  weeklyChart = new Chart(document.getElementById("weeklyChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Water used",
        data: dailyTotals,
        backgroundColor: "#78a5ff",
        hoverBackgroundColor: "#3678f5",
        borderRadius: 6,
        maxBarThickness: 42
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#8590a5" }
        },
        y: {
          beginAtZero: true,
          border: { display: false, dash: [4, 4] },
          grid: { color: "#edf1f7" },
          ticks: { color: "#8590a5" }
        }
      }
    }
  });

  categoryChart = new Chart(document.getElementById("categoryChart"), {
    type: "doughnut",
    data: {
      labels: categories,
      datasets: [{
        data: categoryTotals,
        backgroundColor: chartColors,
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context =>
              `${context.label}: ${formatLiters(context.parsed)} L`
          }
        }
      }
    }
  });

  document.getElementById("categoryLegend").innerHTML =
    categories.map((category, index) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${chartColors[index]}"></span>
        <span>${category}</span>
        <span class="legend-value">${formatLiters(categoryTotals[index])} L</span>
      </div>
    `).join("");

  trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Actual usage",
          data: dailyTotals,
          borderColor: "#3678f5",
          backgroundColor: "rgba(54,120,245,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: "Daily target",
          data: dates.map(() => DAILY_LIMIT),
          borderColor: "#e6a044",
          borderDash: [6, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      ...commonOptions,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 7, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: context =>
              `${context.dataset.label}: ${formatLiters(context.parsed.y)} L`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#8590a5" }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: "#edf1f7" },
          ticks: { color: "#8590a5" }
        }
      }
    }
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderTable(usages) {
  const recent = [...usages]
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )
    .slice(0, 10);

  if (!recent.length) {
    usageTable.innerHTML = `
      <tr><td colspan="4" class="empty-state">
        No records yet. Add your first water usage entry.
      </td></tr>`;
    return;
  }

  usageTable.innerHTML = recent.map(item => `
    <tr>
      <td>${escapeHTML(item.date)}</td>
      <td><span class="category-badge">${escapeHTML(item.category)}</span></td>
      <td><strong>${formatLiters(item.liters)} L</strong></td>
      <td><button class="delete-btn" data-id="${escapeHTML(item._id)}">Delete</button></td>
    </tr>
  `).join("");
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const liters = Number(litersInput.value);

  if (!Number.isFinite(liters) || liters <= 0) {
    showMessage("Enter a value greater than zero, such as 0.75.", "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const response = await fetch("/api/usages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dateInput.value,
        category: categoryInput.value,
        liters
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to save this record.");
    }

    form.reset();
    dateInput.value = getLocalDate();

    showMessage("Usage saved. Your dashboard has been updated.", "success");
    await loadUsages();
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Usage Record";
  }
});

usageTable.addEventListener("click", async event => {
  const button = event.target.closest(".delete-btn");
  if (!button) return;

  if (!confirm("Delete this water usage record?")) return;

  button.disabled = true;

  try {
    const response = await fetch(
      `/api/usages/${encodeURIComponent(button.dataset.id)}`,
      { method: "DELETE" }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to delete record.");
    }

    showMessage("Record deleted. Charts have been updated.", "success");
    await loadUsages();
  } catch (error) {
    showMessage(error.message, "error");
    button.disabled = false;
  }
});

loadUsages();
