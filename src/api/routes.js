const express = require("express");
const { toErrorPayload } = require("../domain/errors");

function createApiRouter(service) {
  const router = express.Router();

  function handleError(res, error) {
    const payload = toErrorPayload(error);
    res.status(payload.status).json(payload.body);
  }

  router.get("/bootstrap", async (req, res) => {
    try {
      await service.ensureFreshExchangeRates();
      const data = await service.getBootstrap({ year: req.query.year, month: req.query.month });
      res.json(data);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post("/entries", async (req, res) => {
    try {
      const entry = await service.createEntry(req.body || {});
      res.status(201).json(entry);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.delete("/entries/:id", async (req, res) => {
    try {
      await service.deleteEntry(req.params.id);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  router.patch("/categories/:id/budget", async (req, res) => {
    try {
      const category = await service.updateCategoryBudget(req.params.id, req.body || {});
      res.json(category);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post("/categories", async (req, res) => {
    try {
      const category = await service.createCategory(req.body || {});
      res.status(201).json(category);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.patch("/categories/:id", async (req, res) => {
    try {
      const category = await service.updateCategory(req.params.id, req.body || {});
      res.json(category);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.delete("/categories/:id", async (req, res) => {
    try {
      const result = await service.deleteCategory(req.params.id);
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post("/sections", async (req, res) => {
    try {
      const section = await service.createSection(req.body || {});
      res.status(201).json(section);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.delete("/sections/:id", async (req, res) => {
    try {
      await service.deleteSection(req.params.id);
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  });

  router.get("/exchange-rates", async (_req, res) => {
    try {
      await service.ensureFreshExchangeRates();
      const exchange = await service.getExchangeRates();
      res.json(exchange);
    } catch (error) {
      handleError(res, error);
    }
  });

  router.post("/exchange-rates/refresh", async (_req, res) => {
    try {
      const exchange = await service.refreshExchangeRates();
      res.json(exchange);
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}

module.exports = {
  createApiRouter
};
