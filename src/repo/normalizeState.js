const { emptyState } = require("../domain/defaults");
const { slugify, randomId } = require("../domain/utils");

function normalizeState(state) {
  const safe = state && typeof state === "object" ? state : {};

  const sections = Array.isArray(safe.sections)
    ? safe.sections.map((section) => ({
        id: String(section.id || slugify(section.name)),
        name: String(section.name || section.id || "SECTION").toUpperCase()
      }))
    : emptyState.sections.map((s) => ({ ...s }));

  const defaultSectionId = sections[0] ? sections[0].id : "variable";

  const categories = Array.isArray(safe.categories)
    ? safe.categories.map((category) => {
        const type = category.type === "income" ? "income" : "expense";
        return {
          id: String(category.id || `${type}-${slugify(category.name || "category")}-${Math.random().toString(36).slice(2, 6)}`),
          name: String(category.name || "Unnamed"),
          type,
          sectionId: String(category.sectionId || category.group || defaultSectionId),
          budget: Number(category.budget) || 0
        };
      })
    : emptyState.categories.map((c) => ({ ...c }));

  const entries = Array.isArray(safe.entries)
    ? safe.entries.map((entry) => {
        const type = entry.type === "income" ? "income" : "expense";
        const categoryById = categories.find((c) => c.id === entry.categoryId);
        const categoryByName = categories.find((c) => c.type === type && c.name === entry.category);
        const category = categoryById || categoryByName;

        return {
          id: String(entry.id || randomId("entry")),
          date: String(entry.date || ""),
          type,
          categoryId: category ? category.id : null,
          category: category ? category.name : String(entry.category || ""),
          description: String(entry.description || ""),
          amount: Number(entry.amount) || 0,
          paymentMethod: String(entry.paymentMethod || "Card")
        };
      }).filter((entry) => entry.date && entry.category && entry.description && entry.amount > 0)
    : [];

  const categoryBudgets = Array.isArray(safe.categoryBudgets)
    ? safe.categoryBudgets
      .map((item) => ({
        categoryId: String(item.categoryId || "").trim(),
        monthKey: String(item.monthKey || "").trim(),
        budget: Number(item.budget),
        changedAt: item.changedAt ? String(item.changedAt) : null
      }))
      .filter((item) => item.categoryId && /^\d{4}-\d{2}$/.test(item.monthKey) && Number.isFinite(item.budget) && item.budget >= 0)
      .map((item) => ({
        categoryId: item.categoryId,
        monthKey: item.monthKey,
        budget: Number(item.budget.toFixed(2)),
        changedAt: item.changedAt
      }))
    : [];

  const exchangeCache = safe.exchangeCache && typeof safe.exchangeCache === "object"
    ? {
        rows: Array.isArray(safe.exchangeCache.rows) ? safe.exchangeCache.rows : [],
        fetchedAt: Number(safe.exchangeCache.fetchedAt) || 0,
        updatedAt: safe.exchangeCache.updatedAt || null
      }
    : { ...emptyState.exchangeCache };

  return {
    entries,
    sections,
    categories,
    categoryBudgets,
    exchangeCache
  };
}

module.exports = {
  normalizeState
};
