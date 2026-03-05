class BudgetRepository {
  async readState() {
    throw new Error("Not implemented");
  }

  async writeState(_state) {
    throw new Error("Not implemented");
  }

  async healthCheck() {
    return true;
  }
}

module.exports = {
  BudgetRepository
};
