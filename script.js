const toneClassCount = 6;
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const board = document.getElementById("board");
const entryForm = document.getElementById("entryForm");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("entryType");
const categoryInput = document.getElementById("category");
const transactionsBody = document.getElementById("transactionsBody");
const yearSelect = document.getElementById("yearSelect");
const monthButtons = document.getElementById("monthButtons");
const exchangeBody = document.getElementById("exchangeBody");
const exchangeStatus = document.getElementById("exchangeStatus");
const refreshRatesBtn = document.getElementById("refreshRatesBtn");

const now = new Date();
let selectedYear = now.getFullYear();
let selectedMonth = now.getMonth() + 1;
let appState = null;

dateInput.value = formatLocalDate(getDefaultDateForMonth(selectedYear, selectedMonth));

yearSelect.addEventListener("change", async () => {
  selectedYear = Number(yearSelect.value) || selectedYear;
  await reloadAndRender();
});

refreshRatesBtn.addEventListener("click", async () => {
  refreshRatesBtn.setAttribute("disabled", "true");
  try {
    await window.BudgetApi.refreshExchangeRates();
    await reloadAndRender();
  } catch (error) {
    exchangeStatus.textContent = `Error: ${error.message}`;
  } finally {
    refreshRatesBtn.removeAttribute("disabled");
  }
});

typeInput.addEventListener("change", renderEntryCategorySelect);

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    date: entryForm.date.value,
    type: entryForm.entryType.value,
    categoryId: entryForm.category.value,
    description: entryForm.description.value.trim(),
    amount: Number(entryForm.amount.value),
    paymentMethod: entryForm.paymentMethod.value
  };

  if (!payload.date || !payload.categoryId || !payload.description || Number.isNaN(payload.amount) || payload.amount <= 0) {
    return;
  }

  await withApiHandling(async () => {
    await window.BudgetApi.createEntry(payload);
    entryForm.reset();
    dateInput.value = formatLocalDate(getDefaultDateForMonth(selectedYear, selectedMonth));
    typeInput.value = payload.type;
    await reloadAndRender();
  });
});

board.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("budget-input")) {
    return;
  }

  const categoryId = target.dataset.categoryId;
  const value = Number(target.value);
  if (!categoryId || Number.isNaN(value) || value < 0) {
    await reloadAndRender();
    return;
  }

  await withApiHandling(async () => {
    await window.BudgetApi.updateCategoryBudget(categoryId, value, appState.selected.monthKey);
    await reloadAndRender();
  });
});

transactionsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("delete-btn")) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  await withApiHandling(async () => {
    await window.BudgetApi.deleteEntry(id);
    await reloadAndRender();
  });
});

function renderYearOptions() {
  yearSelect.innerHTML = "";
  appState.years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });

  if (!appState.years.includes(selectedYear)) {
    selectedYear = appState.selected.year;
  }
  yearSelect.value = String(selectedYear);
}

function renderMonthButtons() {
  monthButtons.innerHTML = "";

  monthNames.forEach((label, index) => {
    const month = index + 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-btn${month === selectedMonth ? " active" : ""}`;
    button.textContent = label;
    button.dataset.month = String(month);
    button.addEventListener("click", async () => {
      selectedMonth = month;
      await reloadAndRender();
    });
    monthButtons.appendChild(button);
  });
}

function renderBoard() {
  board.innerHTML = "";

  appState.board.sections.forEach((section, index) => {
    board.appendChild(buildSectionSheet(section, `tone-${index % toneClassCount}`, appState.selected.monthKey));
  });

  board.appendChild(buildSavingsUsdSheet(`tone-${appState.board.sections.length % toneClassCount}`, appState.selected.monthKey));
}

function buildSectionSheet(section, toneClass, selectedMonthKey) {
  const sheet = document.createElement("article");
  sheet.className = `sheet ${toneClass}`;

  const bodyRows = section.rows.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td><input class="budget-input" type="number" min="0" step="0.01" value="${item.budget}" data-category-id="${escapeHtml(item.id)}"></td>
      <td>${fmt(item.actual)}</td>
      <td class="${item.difference < 0 ? "negative" : "positive"}">${fmt(item.difference)}</td>
    </tr>
  `).join("");

  sheet.innerHTML = `
    <header>${escapeHtml(section.sectionName)} (${formatMonthLabel(selectedMonthKey)})</header>
    <table>
      <thead><tr><th>Name</th><th>Budget</th><th>Actual</th><th>Difference</th></tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td>${fmt(section.totalBudget)}</td><td>${fmt(section.totalActual)}</td><td class="${section.totalDiff < 0 ? "negative" : "positive"}">${fmt(section.totalDiff)}</td></tr></tfoot>
    </table>
  `;

  return sheet;
}

function buildSavingsUsdSheet(toneClass, selectedMonthKey) {
  const sheet = document.createElement("article");
  sheet.className = `sheet ${toneClass}`;

  const data = appState.board.savingsUsd;
  const bodyRows = data.rows.map((item) => `
    <tr><td>${escapeHtml(item.name)}</td><td>${fmtUsdFromUah(item.budget, data.usdToUahRate)}</td><td>${fmtUsdFromUah(item.actual, data.usdToUahRate)}</td><td class="${item.difference < 0 ? "negative" : "positive"}">${fmtUsdFromUah(item.difference, data.usdToUahRate)}</td></tr>
  `).join("");

  sheet.innerHTML = `
    <header>SAVINGS IN $ (${formatMonthLabel(selectedMonthKey)})</header>
    <table>
      <thead><tr><th>Name</th><th>Budget</th><th>Actual</th><th>Difference</th></tr></thead>
      <tbody>${bodyRows || '<tr><td colspan="4">No savings section.</td></tr>'}</tbody>
      <tfoot><tr><td>TOTAL</td><td>${fmtUsdFromUah(data.totalBudget, data.usdToUahRate)}</td><td>${fmtUsdFromUah(data.totalActual, data.usdToUahRate)}</td><td class="${data.totalDiff < 0 ? "negative" : "positive"}">${fmtUsdFromUah(data.totalDiff, data.usdToUahRate)}</td></tr></tfoot>
    </table>
  `;

  return sheet;
}

function renderTransactions() {
  transactionsBody.innerHTML = "";

  if (appState.transactions.length === 0) {
    transactionsBody.innerHTML = `<tr><td colspan="6">No transactions for ${formatMonthLabel(appState.selected.monthKey)}.</td></tr>`;
    return;
  }

  appState.transactions.forEach((entry) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(formatDate(entry.date))}</td>
      <td>${escapeHtml(entry.category)}</td>
      <td>${escapeHtml(entry.description)}</td>
      <td>${fmt(entry.amount)}</td>
      <td>${escapeHtml(entry.paymentMethod)}</td>
      <td><button class="delete-btn" data-id="${entry.id}" type="button">x</button></td>
    `;
    transactionsBody.appendChild(tr);
  });
}

function renderEntryCategorySelect() {
  if (!appState) {
    return;
  }

  const type = typeInput.value;
  const selected = categoryInput.value;
  const filtered = appState.categories.filter((item) => item.type === type).sort((a, b) => a.name.localeCompare(b.name));

  categoryInput.innerHTML = "";
  filtered.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    categoryInput.appendChild(option);
  });

  const exists = filtered.some((item) => item.id === selected);
  if (exists) {
    categoryInput.value = selected;
  }
}

function renderExchangeRows() {
  exchangeBody.innerHTML = "";
  appState.exchange.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(row.pair)}</td><td>${formatRate(row.buy)}</td><td>${formatRate(row.sell)}</td><td>${formatRate(row.cross)}</td>`;
    exchangeBody.appendChild(tr);
  });

  if (appState.exchange.rows.length === 0) {
    exchangeBody.innerHTML = '<tr><td colspan="4">Unable to load rates.</td></tr>';
  }

  if (appState.exchange.fetchedAt) {
    exchangeStatus.textContent = `Updated: ${formatDateTime(new Date(appState.exchange.fetchedAt))}`;
  } else {
    exchangeStatus.textContent = "No exchange rates loaded.";
  }
}

async function reloadAndRender() {
  appState = await window.BudgetApi.getBootstrap(selectedYear, selectedMonth);
  selectedYear = appState.selected.year;
  selectedMonth = appState.selected.month;

  renderYearOptions();
  renderMonthButtons();
  syncDateInputWithSelectedMonth();
  renderBoard();
  renderTransactions();
  renderEntryCategorySelect();
  renderExchangeRows();
}

async function withApiHandling(action) {
  try {
    await action();
  } catch (error) {
    alert(error.message);
  }
}

function formatRate(value) {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function fmt(value) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(value);
}

function fmtUsdFromUah(valueUah, rate) {
  if (typeof rate !== "number" || rate <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(valueUah / rate);
}

function formatMonthLabel(month) {
  const [year, monthNum] = month.split("-").map(Number);
  if (!year || !monthNum) {
    return month;
  }

  return new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(new Date(year, monthNum - 1, 1));
}

function formatDate(value) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDefaultDateForMonth(year, month) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const day = isCurrentMonth ? today.getDate() : 1;
  return new Date(year, month - 1, day);
}

function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function syncDateInputWithSelectedMonth() {
  const parsed = parseDateParts(dateInput.value);
  const alreadyInSelectedMonth = parsed && parsed.year === selectedYear && parsed.month === selectedMonth;
  if (alreadyInSelectedMonth) {
    return;
  }

  dateInput.value = formatLocalDate(getDefaultDateForMonth(selectedYear, selectedMonth));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

reloadAndRender().catch((error) => {
  alert(error.message);
});
