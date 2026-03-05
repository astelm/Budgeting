function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function getMonthKeyFromYearMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 1900 || y > 3000) {
    throw new Error("Invalid year.");
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error("Invalid month.");
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }
  return Number(amount.toFixed(2));
}

function randomId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = {
  slugify,
  monthKey,
  getMonthKeyFromYearMonth,
  normalizeAmount,
  randomId
};
