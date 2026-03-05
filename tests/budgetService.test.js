const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { JsonFileBudgetRepository } = require("../src/repo/JsonFileBudgetRepository");
const { BudgetService } = require("../src/services/BudgetService");

async function createServiceWithState(state) {
  const tempFile = path.join(os.tmpdir(), `budget-service-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), "utf8");
  const repository = new JsonFileBudgetRepository(tempFile);
  const service = new BudgetService(repository);
  return { service, tempFile };
}

test("builds monthly board totals and differences", async () => {
  const { service, tempFile } = await createServiceWithState({
    sections: [{ id: "fixed", name: "FIXED" }, { id: "savings", name: "SAVINGS" }],
    categories: [
      { id: "c-rent", name: "Rent", type: "expense", sectionId: "fixed", budget: 1000 },
      { id: "c-emergency", name: "Emergency", type: "expense", sectionId: "savings", budget: 200 }
    ],
    entries: [
      { id: "e1", date: "2026-03-01", type: "expense", categoryId: "c-rent", category: "Rent", description: "Rent", amount: 900, paymentMethod: "Card" },
      { id: "e2", date: "2026-03-03", type: "expense", categoryId: "c-emergency", category: "Emergency", description: "Savings", amount: 250, paymentMethod: "Card" },
      { id: "e3", date: "2026-02-20", type: "expense", categoryId: "c-rent", category: "Rent", description: "Old", amount: 300, paymentMethod: "Card" }
    ]
  });

  const bootstrap = await service.getBootstrap({ year: 2026, month: 3 });
  const fixed = bootstrap.board.sections.find((section) => section.sectionId === "fixed");
  const savings = bootstrap.board.sections.find((section) => section.sectionId === "savings");

  assert.equal(fixed.rows[0].actual, 900);
  assert.equal(fixed.totalDiff, 100);
  assert.equal(savings.rows[0].difference, -50);
  assert.equal(bootstrap.transactions.length, 2);

  await fs.unlink(tempFile);
});

test("renaming category updates entries", async () => {
  const { service, tempFile } = await createServiceWithState({
    sections: [{ id: "variable", name: "VARIABLE" }],
    categories: [{ id: "c-grocery", name: "Groceries", type: "expense", sectionId: "variable", budget: 100 }],
    entries: [{ id: "e1", date: "2026-03-01", type: "expense", categoryId: "c-grocery", category: "Groceries", description: "food", amount: 10, paymentMethod: "Card" }]
  });

  await service.updateCategory("c-grocery", { name: "Food" });
  const bootstrap = await service.getBootstrap({ year: 2026, month: 3 });

  assert.equal(bootstrap.categories[0].name, "Food");
  assert.equal(bootstrap.transactions[0].category, "Food");

  await fs.unlink(tempFile);
});

test("deleting expense category reassigns entries to fallback", async () => {
  const { service, tempFile } = await createServiceWithState({
    sections: [{ id: "variable", name: "VARIABLE" }],
    categories: [
      { id: "c-food", name: "Food", type: "expense", sectionId: "variable", budget: 100 },
      { id: "c-gas", name: "Gas", type: "expense", sectionId: "variable", budget: 50 }
    ],
    entries: [{ id: "e1", date: "2026-03-01", type: "expense", categoryId: "c-food", category: "Food", description: "food", amount: 10, paymentMethod: "Card" }]
  });

  const result = await service.deleteCategory("c-food");
  assert.equal(result.fallbackCategoryName, "Other");

  const bootstrap = await service.getBootstrap({ year: 2026, month: 3 });
  assert.equal(bootstrap.transactions[0].category, "Other");

  await fs.unlink(tempFile);
});

test("section deletion blocked when categories exist", async () => {
  const { service, tempFile } = await createServiceWithState({
    sections: [{ id: "fixed", name: "FIXED" }],
    categories: [{ id: "c-rent", name: "Rent", type: "expense", sectionId: "fixed", budget: 1000 }],
    entries: []
  });

  await assert.rejects(() => service.deleteSection("fixed"), /Cannot remove section/);
  await fs.unlink(tempFile);
});

test("exchange rate prefers average buy/sell", async () => {
  const { service, tempFile } = await createServiceWithState({ sections: [], categories: [], entries: [] });
  const rate = service.pickUsdRate({ pair: "USD/UAH", buy: 39.2, sell: 39.8 });
  assert.equal(rate, 39.5);
  await fs.unlink(tempFile);
});
