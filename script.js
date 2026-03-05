const defaultSections = [
  { id: "income", name: "INCOME" },
  { id: "fixed", name: "FIXED BILLS" },
  { id: "variable", name: "VARIABLE BILLS" },
  { id: "savings", name: "SAVINGS" },
  { id: "subscriptions", name: "SUBSCRIPTIONS" },
  { id: "personal", name: "PERSONAL" }
];

const defaultCategories = [
  { name: "Paycheck1", type: "income", sectionId: "income", budget: 2500 },
  { name: "Paycheck2", type: "income", sectionId: "income", budget: 2500 },
  { name: "Gift", type: "income", sectionId: "income", budget: 0 },
  { name: "Rent", type: "expense", sectionId: "fixed", budget: 1200 },
  { name: "Internet", type: "expense", sectionId: "fixed", budget: 80 },
  { name: "Phone", type: "expense", sectionId: "fixed", budget: 55 },
  { name: "Groceries", type: "expense", sectionId: "variable", budget: 550 },
  { name: "Gas", type: "expense", sectionId: "variable", budget: 220 },
  { name: "Dining Out", type: "expense", sectionId: "variable", budget: 220 },
  { name: "Entertainment", type: "expense", sectionId: "variable", budget: 170 },
  { name: "Other", type: "expense", sectionId: "variable", budget: 140 },
  { name: "Emergency Fund", type: "expense", sectionId: "savings", budget: 300 },
  { name: "Retirement", type: "expense", sectionId: "savings", budget: 300 },
  { name: "Netflix", type: "expense", sectionId: "subscriptions", budget: 16 },
  { name: "YouTube", type: "expense", sectionId: "subscriptions", budget: 13 },
  { name: "Education", type: "expense", sectionId: "personal", budget: 160 },
  { name: "Gifts", type: "expense", sectionId: "personal", budget: 130 }
];

const keys = {
  entries: "budget_tracker_entries_v2",
  categories: "budget_tracker_categories_v2",
  sections: "budget_tracker_sections_v3",
  exchangeCache: "budget_tracker_exchange_cache_v1"
};

const MONOBANK_CURRENCY_API = "https://api.monobank.ua/bank/currency";
const UAH = 980;
const toneClassCount = 6;
const exchangeCacheTtlMs = 5 * 60 * 1000;
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

let entries = load(keys.entries, []);
let sections = load(keys.sections, defaultSections);
let categories = normalizeCategories(load(keys.categories, defaultCategories));
let usdToUahRate;

const now = new Date();
let selectedYear = now.getFullYear();
let selectedMonthIndex = now.getMonth();

dateInput.value = new Date().toISOString().split("T")[0];

migrateLegacyCategories();
renderYearOptions();
renderMonthButtons();
renderAll();
loadExchangeRates({ force: false });
setInterval(() => loadExchangeRates({ force: false }), exchangeCacheTtlMs);

yearSelect.addEventListener("change", () => {
  selectedYear = Number(yearSelect.value) || now.getFullYear();
  renderMonthButtons();
  renderBoard();
  renderTransactions();
});

refreshRatesBtn.addEventListener("click", () => loadExchangeRates({ force: true }));
typeInput.addEventListener("change", renderEntryCategorySelect);

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = {
    id: crypto.randomUUID(),
    date: entryForm.date.value,
    type: entryForm.entryType.value,
    category: entryForm.category.value,
    description: entryForm.description.value.trim(),
    amount: Number(entryForm.amount.value),
    paymentMethod: entryForm.paymentMethod.value
  };

  if (!payload.date || !payload.category || !payload.description || Number.isNaN(payload.amount) || payload.amount <= 0) return;

  entries.unshift(payload);
  save(keys.entries, entries);

  entryForm.reset();
  dateInput.value = new Date().toISOString().split("T")[0];
  typeInput.value = payload.type;

  renderYearOptions();
  renderMonthButtons();
  renderBoard();
  renderTransactions();
  renderEntryCategorySelect();
});

board.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("budget-input")) return;

  const { name, type, section: sectionId } = target.dataset;
  const value = Number(target.value);
  if (!name || !type || !sectionId || Number.isNaN(value) || value < 0) {
    renderBoard();
    return;
  }

  const item = categories.find((c) => c.name === name && c.type === type && c.sectionId === sectionId);
  if (!item) return;

  item.budget = value;
  save(keys.categories, categories);
  renderBoard();
});

transactionsBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("delete-btn")) return;

  const id = target.dataset.id;
  entries = entries.filter((item) => item.id !== id);
  save(keys.entries, entries);
  renderYearOptions();
  renderBoard();
  renderTransactions();
});

function renderAll() {
  renderBoard();
  renderTransactions();
  renderEntryCategorySelect();
}

function getSelectedMonthKey() {
  return `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, "0")}`;
}

function renderYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]);

  entries.forEach((entry) => {
    const y = Number(String(entry.date || "").slice(0, 4));
    if (Number.isInteger(y) && y > 1900 && y < 3000) {
      years.add(y);
    }
  });

  const sortedYears = [...years].sort((a, b) => b - a);

  yearSelect.innerHTML = "";
  sortedYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });

  if (!sortedYears.includes(selectedYear)) {
    selectedYear = sortedYears[0] || currentYear;
  }
  yearSelect.value = String(selectedYear);
}

function renderMonthButtons() {
  monthButtons.innerHTML = "";

  monthNames.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `month-btn${index === selectedMonthIndex ? " active" : ""}`;
    button.textContent = label;
    button.dataset.month = String(index);
    button.addEventListener("click", () => {
      selectedMonthIndex = index;
      renderMonthButtons();
      renderBoard();
      renderTransactions();
    });
    monthButtons.appendChild(button);
  });
}

function renderBoard() {
  const selectedMonth = getSelectedMonthKey();

  board.innerHTML = "";
  sections.forEach((section, index) => board.appendChild(buildSectionSheet(section, `tone-${index % toneClassCount}`, selectedMonth)));
  board.appendChild(buildSavingsUsdSheet(`tone-${sections.length % toneClassCount}`, selectedMonth));
}

function buildSectionSheet(section, toneClass, selectedMonth) {
  const sheet = document.createElement("article");
  sheet.className = `sheet ${toneClass}`;

  const rows = categories.filter((c) => c.sectionId === section.id).sort((a, b) => a.name.localeCompare(b.name));
  const metrics = rows.map((row) => {
    const actual = entries
      .filter((entry) => entry.type === row.type && entry.category === row.name && monthKey(entry.date) === selectedMonth)
      .reduce((sum, entry) => sum + entry.amount, 0);

    return { ...row, actual, difference: row.budget - actual };
  });

  const totalBudget = metrics.reduce((sum, item) => sum + item.budget, 0);
  const totalActual = metrics.reduce((sum, item) => sum + item.actual, 0);
  const totalDiff = totalBudget - totalActual;

  const bodyRows = metrics.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td><input class="budget-input" type="number" min="0" step="0.01" value="${item.budget}" data-name="${escapeHtml(item.name)}" data-type="${escapeHtml(item.type)}" data-section="${escapeHtml(item.sectionId)}"></td>
      <td>${fmt(item.actual)}</td>
      <td class="${item.difference < 0 ? "negative" : "positive"}">${fmt(item.difference)}</td>
    </tr>
  `).join("");

  sheet.innerHTML = `
    <header>${escapeHtml(section.name)} (${formatMonthLabel(selectedMonth)})</header>
    <table>
      <thead><tr><th>Name</th><th>Budget</th><th>Actual</th><th>Difference</th></tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr><td>TOTAL</td><td>${fmt(totalBudget)}</td><td>${fmt(totalActual)}</td><td class="${totalDiff < 0 ? "negative" : "positive"}">${fmt(totalDiff)}</td></tr></tfoot>
    </table>
  `;

  return sheet;
}

function buildSavingsUsdSheet(toneClass, selectedMonth) {
  const sheet = document.createElement("article");
  sheet.className = `sheet ${toneClass}`;

  const savingsSection = sections.find((s) => s.id === "savings") || sections.find((s) => s.name.toLowerCase().includes("saving"));
  const rows = savingsSection
    ? categories.filter((c) => c.sectionId === savingsSection.id).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const metrics = rows.map((row) => {
    const actual = entries
      .filter((entry) => entry.type === row.type && entry.category === row.name && monthKey(entry.date) === selectedMonth)
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { ...row, actual, difference: row.budget - actual };
  });

  const totalBudget = metrics.reduce((sum, item) => sum + item.budget, 0);
  const totalActual = metrics.reduce((sum, item) => sum + item.actual, 0);
  const totalDiff = totalBudget - totalActual;

  const bodyRows = metrics.map((item) => `
    <tr><td>${escapeHtml(item.name)}</td><td>${fmtUsdFromUah(item.budget)}</td><td>${fmtUsdFromUah(item.actual)}</td><td class="${item.difference < 0 ? "negative" : "positive"}">${fmtUsdFromUah(item.difference)}</td></tr>
  `).join("");

  sheet.innerHTML = `
    <header>SAVINGS IN $ (${formatMonthLabel(selectedMonth)})</header>
    <table>
      <thead><tr><th>Name</th><th>Budget</th><th>Actual</th><th>Difference</th></tr></thead>
      <tbody>${bodyRows || '<tr><td colspan="4">No savings section.</td></tr>'}</tbody>
      <tfoot><tr><td>TOTAL</td><td>${fmtUsdFromUah(totalBudget)}</td><td>${fmtUsdFromUah(totalActual)}</td><td class="${totalDiff < 0 ? "negative" : "positive"}">${fmtUsdFromUah(totalDiff)}</td></tr></tfoot>
    </table>
  `;

  return sheet;
}

function renderTransactions() {
  const selectedMonth = getSelectedMonthKey();
  const monthEntries = entries.filter((entry) => monthKey(entry.date) === selectedMonth);
  transactionsBody.innerHTML = "";

  if (monthEntries.length === 0) {
    transactionsBody.innerHTML = `<tr><td colspan="6">No transactions for ${formatMonthLabel(selectedMonth)}.</td></tr>`;
    return;
  }

  monthEntries.forEach((entry) => {
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
  const type = typeInput.value;
  const filtered = categories.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));
  categoryInput.innerHTML = "";
  filtered.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = item.name;
    categoryInput.appendChild(option);
  });
}

async function loadExchangeRates(options = {}) {
  const { force = false } = options;
  const cached = load(keys.exchangeCache, null);
  const isFreshCache = cached && Array.isArray(cached.rows) && typeof cached.fetchedAt === "number" && Date.now() - cached.fetchedAt < exchangeCacheTtlMs;

  if (!force && isFreshCache) {
    applyExchangeRows(cached.rows, cached.updatedAt);
    exchangeStatus.textContent = `Cached: ${formatDateTime(new Date(cached.fetchedAt))}`;
    return;
  }

  exchangeStatus.textContent = "Loading exchange rates...";
  refreshRatesBtn.setAttribute("disabled", "true");

  try {
    const response = await fetch(MONOBANK_CURRENCY_API);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const rows = [buildPairRow(data, 840, "USD/UAH"), buildPairRow(data, 978, "EUR/UAH")].filter(Boolean);

    const maxUnix = rows.reduce((max, row) => Math.max(max, row.date || 0), 0);
    const updatedAt = maxUnix ? new Date(maxUnix * 1000).toISOString() : new Date().toISOString();

    save(keys.exchangeCache, {
      rows,
      fetchedAt: Date.now(),
      updatedAt
    });

    applyExchangeRows(rows, updatedAt);
    exchangeStatus.textContent = `Updated: ${formatDateTime(new Date(updatedAt))}`;
  } catch (error) {
    if (cached && Array.isArray(cached.rows)) {
      applyExchangeRows(cached.rows, cached.updatedAt);
      exchangeStatus.textContent = `Using cached rates: ${formatDateTime(new Date(cached.fetchedAt))}`;
    } else {
      exchangeBody.innerHTML = '<tr><td colspan="4">Unable to load rates.</td></tr>';
      exchangeStatus.textContent = `Error: ${error.message}`;
    }
  } finally {
    refreshRatesBtn.removeAttribute("disabled");
  }
}

function applyExchangeRows(rows, updatedAt) {
  renderExchangeRows(rows);
  const usdRow = rows.find((row) => row.pair === "USD/UAH");
  usdToUahRate = pickUsdRate(usdRow);
  renderBoard();

  if (updatedAt) {
    exchangeStatus.textContent = `Updated: ${formatDateTime(new Date(updatedAt))}`;
  }
}

function buildPairRow(source, currencyCode, pairLabel) {
  const direct = source.find((row) => row.currencyCodeA === currencyCode && row.currencyCodeB === UAH);
  if (direct) return { pair: pairLabel, buy: direct.rateBuy, sell: direct.rateSell, cross: direct.rateCross, date: direct.date };

  const inverse = source.find((row) => row.currencyCodeA === UAH && row.currencyCodeB === currencyCode);
  if (!inverse) return null;
  const inv = inverse.rateCross || inverse.rateSell || inverse.rateBuy;
  return { pair: pairLabel, buy: undefined, sell: undefined, cross: typeof inv === "number" ? 1 / inv : undefined, date: inverse.date };
}

function pickUsdRate(usdRow) {
  if (!usdRow) return undefined;
  if (typeof usdRow.sell === "number" && typeof usdRow.buy === "number") return (usdRow.sell + usdRow.buy) / 2;
  if (typeof usdRow.cross === "number") return usdRow.cross;
  return usdRow.sell || usdRow.buy;
}

function renderExchangeRows(rows) {
  exchangeBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(row.pair)}</td><td>${formatRate(row.buy)}</td><td>${formatRate(row.sell)}</td><td>${formatRate(row.cross)}</td>`;
    exchangeBody.appendChild(tr);
  });
}

function migrateLegacyCategories() {
  categories = categories.map((c) => (c.sectionId ? c : { ...c, sectionId: c.group || findSectionIdByName("variable") }));
  save(keys.categories, categories);
}

function findSectionIdByName(hint) {
  const found = sections.find((s) => s.id === hint || s.name.toLowerCase().includes(hint.toLowerCase()));
  return found ? found.id : (sections[0] ? sections[0].id : "");
}

function normalizeCategories(list) {
  return list.map((item) => ({ ...item, budget: Number(item.budget) || 0 }));
}

function formatRate(value) {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function fmt(value) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" }).format(value);
}

function fmtUsdFromUah(valueUah) {
  if (typeof usdToUahRate !== "number" || usdToUahRate <= 0) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(valueUah / usdToUahRate);
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function formatMonthLabel(month) {
  const [year, monthNum] = month.split("-").map(Number);
  if (!year || !monthNum) return month;
  return new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(new Date(year, monthNum - 1, 1));
}

function formatDate(value) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}
