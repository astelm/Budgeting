const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../src/app");

async function withServer(initialState, run) {
  const tempFile = path.join(os.tmpdir(), `budget-api-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await fs.writeFile(tempFile, JSON.stringify(initialState, null, 2), "utf8");

  const { app } = createApp({ dataFile: tempFile });
  const server = app.listen(0);
  const port = server.address().port;

  const request = async (method, url, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    return { status: response.status, body: json };
  };

  try {
    await run(request);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.unlink(tempFile);
  }
}

test("bootstrap returns expected shape", async () => {
  await withServer(
    {
      sections: [{ id: "variable", name: "VARIABLE" }],
      categories: [{ id: "c-food", name: "Food", type: "expense", sectionId: "variable", budget: 200 }],
      entries: [{ id: "e1", date: "2026-03-01", type: "expense", categoryId: "c-food", category: "Food", description: "groceries", amount: 20, paymentMethod: "Card" }],
      exchangeCache: { rows: [], fetchedAt: 0, updatedAt: null }
    },
    async (request) => {
      const response = await request("GET", "/api/bootstrap?year=2026&month=3");
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.sections));
      assert.ok(Array.isArray(response.body.categories));
      assert.ok(Array.isArray(response.body.transactions));
      assert.ok(Array.isArray(response.body.board.sections));
    }
  );
});

test("healthz returns ok", async () => {
  await withServer(
    {
      sections: [{ id: "variable", name: "VARIABLE" }],
      categories: [{ id: "c-food", name: "Food", type: "expense", sectionId: "variable", budget: 200 }],
      entries: [],
      exchangeCache: { rows: [], fetchedAt: 0, updatedAt: null }
    },
    async (request) => {
      const response = await request("GET", "/healthz");
      assert.equal(response.status, 200);
      assert.equal(response.body.status, "ok");
    }
  );
});

test("entry validation returns normalized error payload", async () => {
  await withServer(
    {
      sections: [{ id: "variable", name: "VARIABLE" }],
      categories: [{ id: "c-food", name: "Food", type: "expense", sectionId: "variable", budget: 200 }],
      entries: [],
      exchangeCache: { rows: [], fetchedAt: 0, updatedAt: null }
    },
    async (request) => {
      const response = await request("POST", "/api/entries", {
        date: "",
        type: "expense",
        categoryId: "c-food",
        description: "",
        amount: 0,
        paymentMethod: "Card"
      });

      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, "VALIDATION_ERROR");
      assert.ok(response.body.error.message);
    }
  );
});

test("category CRUD endpoints work", async () => {
  await withServer(
    {
      sections: [{ id: "variable", name: "VARIABLE" }],
      categories: [{ id: "c-seed", name: "Seed", type: "expense", sectionId: "variable", budget: 10 }],
      entries: [],
      exchangeCache: { rows: [], fetchedAt: 0, updatedAt: null }
    },
    async (request) => {
      const created = await request("POST", "/api/categories", { name: "Food", type: "expense", sectionId: "variable" });
      assert.equal(created.status, 201);
      assert.equal(created.body.name, "Food");

      const updated = await request("PATCH", `/api/categories/${created.body.id}`, { name: "Groceries" });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.name, "Groceries");

      const removed = await request("DELETE", `/api/categories/${created.body.id}`);
      assert.equal(removed.status, 200);
    }
  );
});
