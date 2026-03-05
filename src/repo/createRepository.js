const path = require("node:path");
const { JsonFileBudgetRepository } = require("./JsonFileBudgetRepository");
const { PostgresBudgetRepository } = require("./PostgresBudgetRepository");

function createRepository(options = {}) {
  const driver = (options.storageDriver || process.env.STORAGE_DRIVER || "json").toLowerCase();

  if (driver === "postgres") {
    const connectionString = options.databaseUrl || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required when STORAGE_DRIVER=postgres.");
    }

    return new PostgresBudgetRepository({ connectionString, pool: options.pool });
  }

  const dataFile = options.dataFile || path.resolve(process.cwd(), "data", "state.json");
  return new JsonFileBudgetRepository(dataFile);
}

module.exports = {
  createRepository
};
