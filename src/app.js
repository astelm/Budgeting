const express = require("express");
const path = require("node:path");
const { createRepository } = require("./repo/createRepository");
const { BudgetService } = require("./services/BudgetService");
const { createApiRouter } = require("./api/routes");

function createApp(options = {}) {
  const repository = options.repository || createRepository(options);
  const service = options.service || new BudgetService(repository);

  const app = express();
  app.use(express.json());

  app.get("/healthz", async (_req, res) => {
    try {
      await repository.healthCheck();
      res.status(200).json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "error" });
    }
  });

  app.use("/api", createApiRouter(service));
  app.use(express.static(path.resolve(process.cwd())));

  return { app, service, repository };
}

module.exports = {
  createApp
};
