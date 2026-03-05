const { AppError } = require("../domain/errors");
const { monthKey, getMonthKeyFromYearMonth, normalizeAmount, slugify, randomId } = require("../domain/utils");

const MONOBANK_CURRENCY_API = "https://api.monobank.ua/bank/currency";
const UAH = 980;
const CACHE_TTL_MS = 5 * 60 * 1000;

class BudgetService {
  constructor(repository) {
    this.repository = repository;
  }

  async getBootstrap({ year, month }) {
    const state = await this.repository.readState();
    const selectedMonth = this.resolveSelectedMonth(state.entries, year, month);
    const exchange = this.getExchangeSummary(state.exchangeCache);
    const board = this.buildBoard(state, selectedMonth, exchange.usdToUahRate);

    return {
      selected: {
        monthKey: selectedMonth,
        year: Number(selectedMonth.slice(0, 4)),
        month: Number(selectedMonth.slice(5, 7))
      },
      years: this.buildYearOptions(state.entries),
      sections: state.sections,
      categories: state.categories,
      board,
      transactions: this.getMonthEntries(state.entries, selectedMonth),
      exchange
    };
  }

  async createEntry(payload) {
    const state = await this.repository.readState();
    const date = String(payload.date || "");
    const type = payload.type === "income" ? "income" : payload.type === "expense" ? "expense" : null;
    const description = String(payload.description || "").trim();
    const paymentMethod = String(payload.paymentMethod || "Card").trim() || "Card";
    const amount = normalizeAmount(payload.amount);
    const categoryId = String(payload.categoryId || "").trim();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError("VALIDATION_ERROR", "Valid date is required.", { field: "date" });
    }
    if (!type) {
      throw new AppError("VALIDATION_ERROR", "Valid entry type is required.", { field: "type" });
    }
    if (!description) {
      throw new AppError("VALIDATION_ERROR", "Description is required.", { field: "description" });
    }
    if (!amount) {
      throw new AppError("VALIDATION_ERROR", "Amount must be greater than 0.", { field: "amount" });
    }

    const category = state.categories.find((item) => item.id === categoryId && item.type === type);
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Category is required.", { field: "categoryId" });
    }

    const entry = {
      id: randomId("entry"),
      date,
      type,
      categoryId: category.id,
      category: category.name,
      description,
      amount,
      paymentMethod
    };

    state.entries.unshift(entry);
    await this.repository.writeState(state);

    return entry;
  }

  async deleteEntry(entryId) {
    const state = await this.repository.readState();
    const before = state.entries.length;
    state.entries = state.entries.filter((entry) => entry.id !== entryId);

    if (state.entries.length === before) {
      throw new AppError("NOT_FOUND", "Entry not found.", { entryId }, 404);
    }

    await this.repository.writeState(state);
  }

  async createCategory(payload) {
    const state = await this.repository.readState();
    const name = String(payload.name || "").trim();
    const type = payload.type === "income" ? "income" : payload.type === "expense" ? "expense" : null;
    const sectionId = String(payload.sectionId || "").trim();

    if (!name) {
      throw new AppError("VALIDATION_ERROR", "Category name is required.", { field: "name" });
    }
    if (!type) {
      throw new AppError("VALIDATION_ERROR", "Category type is required.", { field: "type" });
    }

    const section = state.sections.find((item) => item.id === sectionId);
    if (!section) {
      throw new AppError("VALIDATION_ERROR", "Valid section is required.", { field: "sectionId" });
    }

    const exists = state.categories.some((item) => item.type === type && item.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      throw new AppError("CONFLICT", "Category with this name already exists for selected type.", { field: "name" }, 409);
    }

    const idBase = `${type}-${slugify(name)}`;
    let categoryId = idBase;
    let idx = 1;
    while (state.categories.some((item) => item.id === categoryId)) {
      categoryId = `${idBase}-${idx}`;
      idx += 1;
    }

    const category = {
      id: categoryId,
      name,
      type,
      sectionId,
      budget: 0
    };

    state.categories.push(category);
    await this.repository.writeState(state);

    return category;
  }

  async updateCategory(categoryId, payload) {
    const state = await this.repository.readState();
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) {
      throw new AppError("NOT_FOUND", "Category not found.", { categoryId }, 404);
    }

    const nextName = payload.name !== undefined ? String(payload.name).trim() : category.name;
    const nextSectionId = payload.sectionId !== undefined ? String(payload.sectionId).trim() : category.sectionId;

    if (!nextName) {
      throw new AppError("VALIDATION_ERROR", "Category name is required.", { field: "name" });
    }

    const section = state.sections.find((item) => item.id === nextSectionId);
    if (!section) {
      throw new AppError("VALIDATION_ERROR", "Valid section is required.", { field: "sectionId" });
    }

    const conflict = state.categories.some(
      (item) => item.id !== category.id && item.type === category.type && item.name.toLowerCase() === nextName.toLowerCase()
    );
    if (conflict) {
      throw new AppError("CONFLICT", "Category with this name already exists for selected type.", { field: "name" }, 409);
    }

    const oldName = category.name;
    category.name = nextName;
    category.sectionId = nextSectionId;

    state.entries = state.entries.map((entry) => {
      if (entry.categoryId === category.id) {
        return { ...entry, category: nextName };
      }

      if (!entry.categoryId && entry.type === category.type && entry.category === oldName) {
        return { ...entry, categoryId: category.id, category: nextName };
      }

      return entry;
    });

    await this.repository.writeState(state);
    return category;
  }

  async updateCategoryBudget(categoryId, payload) {
    const state = await this.repository.readState();
    const budget = Number(payload.budget);
    const category = state.categories.find((item) => item.id === categoryId);

    if (!category) {
      throw new AppError("NOT_FOUND", "Category not found.", { categoryId }, 404);
    }

    if (Number.isNaN(budget) || budget < 0) {
      throw new AppError("VALIDATION_ERROR", "Budget must be 0 or greater.", { field: "budget" });
    }

    category.budget = Number(budget.toFixed(2));
    await this.repository.writeState(state);
    return category;
  }

  async deleteCategory(categoryId) {
    const state = await this.repository.readState();
    const category = state.categories.find((item) => item.id === categoryId);

    if (!category) {
      throw new AppError("NOT_FOUND", "Category not found.", { categoryId }, 404);
    }

    let fallback = null;
    if (category.type === "expense") {
      fallback = this.ensureFallbackExpenseCategory(state, category.sectionId, category.id);

      if (fallback.id === category.id) {
        throw new AppError("VALIDATION_ERROR", "At least one expense category must remain.", { categoryId });
      }

      state.entries = state.entries.map((entry) => {
        if (entry.categoryId === category.id || (!entry.categoryId && entry.type === "expense" && entry.category === category.name)) {
          return { ...entry, categoryId: fallback.id, category: fallback.name };
        }
        return entry;
      });
    }

    state.categories = state.categories.filter((item) => item.id !== category.id);
    await this.repository.writeState(state);

    return {
      removedCategoryId: category.id,
      fallbackCategoryId: fallback ? fallback.id : null,
      fallbackCategoryName: fallback ? fallback.name : null
    };
  }

  async createSection(payload) {
    const state = await this.repository.readState();
    const name = String(payload.name || "").trim();

    if (!name) {
      throw new AppError("VALIDATION_ERROR", "Section name is required.", { field: "name" });
    }

    const exists = state.sections.some((item) => item.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      throw new AppError("CONFLICT", "Section already exists.", { field: "name" }, 409);
    }

    const base = slugify(name) || "section";
    let sectionId = base;
    let idx = 1;
    while (state.sections.some((item) => item.id === sectionId)) {
      sectionId = `${base}-${idx}`;
      idx += 1;
    }

    const section = {
      id: sectionId,
      name: name.toUpperCase()
    };

    state.sections.push(section);
    await this.repository.writeState(state);

    return section;
  }

  async deleteSection(sectionId) {
    const state = await this.repository.readState();
    const section = state.sections.find((item) => item.id === sectionId);
    if (!section) {
      throw new AppError("NOT_FOUND", "Section not found.", { sectionId }, 404);
    }

    const hasCategories = state.categories.some((category) => category.sectionId === sectionId);
    if (hasCategories) {
      throw new AppError("VALIDATION_ERROR", "Cannot remove section with existing categories.", { sectionId });
    }

    state.sections = state.sections.filter((item) => item.id !== sectionId);
    await this.repository.writeState(state);
  }

  async getExchangeRates() {
    const state = await this.repository.readState();
    return this.getExchangeSummary(state.exchangeCache);
  }

  async refreshExchangeRates() {
    const state = await this.repository.readState();
    const refreshed = await this.fetchExchangeCache(state.exchangeCache);
    state.exchangeCache = refreshed;
    await this.repository.writeState(state);
    return this.getExchangeSummary(state.exchangeCache);
  }

  async ensureFreshExchangeRates() {
    const state = await this.repository.readState();
    const cache = state.exchangeCache || {};
    const isFresh = cache.fetchedAt && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

    if (isFresh) {
      return;
    }

    const refreshed = await this.fetchExchangeCache(cache);
    state.exchangeCache = refreshed;
    await this.repository.writeState(state);
  }

  async fetchExchangeCache(currentCache) {
    try {
      const response = await fetch(MONOBANK_CURRENCY_API);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rows = [
        this.buildPairRow(data, 840, "USD/UAH"),
        this.buildPairRow(data, 978, "EUR/UAH")
      ].filter(Boolean);

      const maxUnix = rows.reduce((max, row) => Math.max(max, row.date || 0), 0);
      const updatedAt = maxUnix ? new Date(maxUnix * 1000).toISOString() : new Date().toISOString();

      return {
        rows,
        fetchedAt: Date.now(),
        updatedAt
      };
    } catch (_error) {
      if (currentCache && Array.isArray(currentCache.rows) && currentCache.rows.length > 0) {
        return {
          rows: currentCache.rows,
          fetchedAt: currentCache.fetchedAt || 0,
          updatedAt: currentCache.updatedAt || null
        };
      }

      return {
        rows: [],
        fetchedAt: 0,
        updatedAt: null
      };
    }
  }

  getExchangeSummary(exchangeCache) {
    const rows = Array.isArray(exchangeCache.rows) ? exchangeCache.rows : [];
    const usdRow = rows.find((row) => row.pair === "USD/UAH");
    const usdToUahRate = this.pickUsdRate(usdRow);

    return {
      rows,
      usdToUahRate,
      fetchedAt: exchangeCache.fetchedAt || 0,
      updatedAt: exchangeCache.updatedAt || null
    };
  }

  buildPairRow(source, currencyCode, pairLabel) {
    const direct = source.find((row) => row.currencyCodeA === currencyCode && row.currencyCodeB === UAH);
    if (direct) {
      return {
        pair: pairLabel,
        buy: direct.rateBuy,
        sell: direct.rateSell,
        cross: direct.rateCross,
        date: direct.date
      };
    }

    const inverse = source.find((row) => row.currencyCodeA === UAH && row.currencyCodeB === currencyCode);
    if (!inverse) {
      return null;
    }

    const inv = inverse.rateCross || inverse.rateSell || inverse.rateBuy;
    return {
      pair: pairLabel,
      buy: undefined,
      sell: undefined,
      cross: typeof inv === "number" ? 1 / inv : undefined,
      date: inverse.date
    };
  }

  pickUsdRate(usdRow) {
    if (!usdRow) {
      return null;
    }
    if (typeof usdRow.sell === "number" && typeof usdRow.buy === "number") {
      return (usdRow.sell + usdRow.buy) / 2;
    }
    if (typeof usdRow.cross === "number") {
      return usdRow.cross;
    }
    if (typeof usdRow.sell === "number") {
      return usdRow.sell;
    }
    if (typeof usdRow.buy === "number") {
      return usdRow.buy;
    }
    return null;
  }

  resolveSelectedMonth(entries, year, month) {
    if (year && month) {
      try {
        return getMonthKeyFromYearMonth(year, month);
      } catch {
        // Ignore invalid query and fall back.
      }
    }

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  getMonthEntries(entries, selectedMonth) {
    return entries
      .filter((entry) => monthKey(entry.date) === selectedMonth)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  buildYearOptions(entries) {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]);

    entries.forEach((entry) => {
      const year = Number(String(entry.date || "").slice(0, 4));
      if (Number.isInteger(year) && year > 1900 && year < 3000) {
        years.add(year);
      }
    });

    return [...years].sort((a, b) => b - a);
  }

  buildBoard(state, selectedMonth, usdToUahRate) {
    const sections = state.sections.map((section) => {
      const rows = state.categories
        .filter((category) => category.sectionId === section.id)
        .sort((a, b) => a.name.localeCompare(b.name));

      const metrics = rows.map((row) => {
        const actual = state.entries
          .filter((entry) => monthKey(entry.date) === selectedMonth)
          .filter((entry) => {
            if (entry.categoryId) {
              return entry.categoryId === row.id;
            }
            return entry.type === row.type && entry.category === row.name;
          })
          .reduce((sum, entry) => sum + entry.amount, 0);

        return {
          id: row.id,
          name: row.name,
          type: row.type,
          sectionId: row.sectionId,
          budget: row.budget,
          actual,
          difference: Number((row.budget - actual).toFixed(2))
        };
      });

      const totalBudget = metrics.reduce((sum, item) => sum + item.budget, 0);
      const totalActual = metrics.reduce((sum, item) => sum + item.actual, 0);

      return {
        sectionId: section.id,
        sectionName: section.name,
        rows: metrics,
        totalBudget: Number(totalBudget.toFixed(2)),
        totalActual: Number(totalActual.toFixed(2)),
        totalDiff: Number((totalBudget - totalActual).toFixed(2))
      };
    });

    const savingsSection = state.sections.find((section) => section.id === "savings")
      || state.sections.find((section) => section.name.toLowerCase().includes("saving"));

    const savingsRows = savingsSection
      ? sections.find((section) => section.sectionId === savingsSection.id)?.rows || []
      : [];

    const savingsBudget = savingsRows.reduce((sum, row) => sum + row.budget, 0);
    const savingsActual = savingsRows.reduce((sum, row) => sum + row.actual, 0);

    return {
      sections,
      savingsUsd: {
        rows: savingsRows,
        totalBudget: Number(savingsBudget.toFixed(2)),
        totalActual: Number(savingsActual.toFixed(2)),
        totalDiff: Number((savingsBudget - savingsActual).toFixed(2)),
        usdToUahRate: usdToUahRate || null
      }
    };
  }

  ensureFallbackExpenseCategory(state, sectionId, categoryToDeleteId) {
    const expenseCategories = state.categories.filter((item) => item.type === "expense");
    const fallbackExisting = state.categories.find(
      (item) => item.type === "expense" && item.sectionId === sectionId && item.name === "Other"
    );

    if (fallbackExisting) {
      return fallbackExisting;
    }

    if (expenseCategories.length === 1 && expenseCategories[0].id === categoryToDeleteId) {
      return expenseCategories[0];
    }

    const fallback = {
      id: `expense-other-${Math.random().toString(36).slice(2, 7)}`,
      name: "Other",
      type: "expense",
      sectionId,
      budget: 0
    };

    state.categories.push(fallback);
    return fallback;
  }
}

module.exports = {
  BudgetService
};
