const fs = require("node:fs/promises");
const path = require("node:path");
const { BudgetRepository } = require("./BudgetRepository");
const { emptyState } = require("../domain/defaults");
const { normalizeState } = require("./normalizeState");

class JsonFileBudgetRepository extends BudgetRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async ensureFile() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      const initial = JSON.stringify(emptyState, null, 2);
      await fs.writeFile(this.filePath, initial, "utf8");
    }
  }

  async readState() {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : emptyState;
    return normalizeState(parsed);
  }

  async writeState(nextState) {
    this.writeQueue = this.writeQueue.then(async () => {
      const normalized = normalizeState(nextState);
      await fs.writeFile(this.filePath, JSON.stringify(normalized, null, 2), "utf8");
      return normalized;
    });

    return this.writeQueue;
  }

  async healthCheck() {
    await this.ensureFile();
    return true;
  }
}

module.exports = {
  JsonFileBudgetRepository
};
