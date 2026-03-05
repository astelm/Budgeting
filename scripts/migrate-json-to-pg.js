require("dotenv").config();
const path = require("node:path");
const { JsonFileBudgetRepository } = require("../src/repo/JsonFileBudgetRepository");
const { PostgresBudgetRepository } = require("../src/repo/PostgresBudgetRepository");

async function run() {
  const dataFile = path.resolve(process.cwd(), "data", "state.json");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migrate:json-to-pg.");
  }

  const jsonRepo = new JsonFileBudgetRepository(dataFile);
  const pgRepo = new PostgresBudgetRepository({ connectionString: databaseUrl });

  const state = await jsonRepo.readState();
  await pgRepo.writeState(state);
  await pgRepo.healthCheck();
  await pgRepo.close();

  // eslint-disable-next-line no-console
  console.log("JSON state migrated to Postgres successfully.");
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", error.message);
  process.exit(1);
});
