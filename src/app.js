const express = require("express");
const path = require("node:path");
const { JsonFileBudgetRepository } = require("./repo/JsonFileBudgetRepository");
const { BudgetService } = require("./services/BudgetService");
const { createApiRouter } = require("./api/routes");

function createApp(options = {}) {
  const dataFile = options.dataFile || path.resolve(process.cwd(), "data", "state.json");
  const repository = options.repository || new JsonFileBudgetRepository(dataFile);
  const service = options.service || new BudgetService(repository);

  const app = express();
  app.use(express.json());

  app.use("/api", createApiRouter(service));
  app.use(express.static(path.resolve(process.cwd())));

  return { app, service };
}

module.exports = {
  createApp
};
