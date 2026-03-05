const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeState } = require("../src/repo/normalizeState");

test("normalizeState maps categories entries and exchange cache consistently", () => {
  const result = normalizeState({
    sections: [{ id: "variable", name: "Variable Bills" }],
    categories: [{ id: "c-food", name: "Food", type: "expense", sectionId: "variable", budget: "120.5" }],
    entries: [{
      id: "e1",
      date: "2026-03-10",
      type: "expense",
      categoryId: "c-food",
      category: "Food",
      description: "Grocery",
      amount: "42.15",
      paymentMethod: "Card"
    }],
    exchangeCache: {
      rows: [{ pair: "USD/UAH", buy: 39.1, sell: 39.6 }],
      fetchedAt: 123456,
      updatedAt: "2026-03-01T10:00:00.000Z"
    }
  });

  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].budget, 120.5);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].amount, 42.15);
  assert.equal(result.exchangeCache.rows.length, 1);
  assert.equal(result.exchangeCache.fetchedAt, 123456);
});
