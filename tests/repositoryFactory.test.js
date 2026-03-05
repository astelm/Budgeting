const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRepository } = require("../src/repo/createRepository");
const { JsonFileBudgetRepository } = require("../src/repo/JsonFileBudgetRepository");
const { PostgresBudgetRepository } = require("../src/repo/PostgresBudgetRepository");

test("createRepository defaults to json driver", async () => {
  const repository = createRepository({ dataFile: path.resolve(process.cwd(), "data", "state.json") });
  assert.ok(repository instanceof JsonFileBudgetRepository);
  await repository.healthCheck();
});

test("createRepository throws when postgres without DATABASE_URL", () => {
  assert.throws(
    () => createRepository({ storageDriver: "postgres", databaseUrl: "" }),
    /DATABASE_URL is required/
  );
});

test("createRepository returns postgres repository with connection string", () => {
  const repository = createRepository({ storageDriver: "postgres", databaseUrl: "postgres://user:pass@localhost:5432/budget" });
  assert.ok(repository instanceof PostgresBudgetRepository);
});
