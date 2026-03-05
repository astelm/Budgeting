const { Pool } = require("pg");
const { BudgetRepository } = require("./BudgetRepository");
const { normalizeState } = require("./normalizeState");

class PostgresBudgetRepository extends BudgetRepository {
  constructor(options) {
    super();
    const { connectionString, pool } = options || {};

    if (!pool && !connectionString) {
      throw new Error("DATABASE_URL is required for postgres storage.");
    }

    this.pool = pool || new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
    this.schemaReadyPromise = null;
  }

  async ensureSchema() {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        const client = await this.pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`
            CREATE TABLE IF NOT EXISTS sections (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL
            )
          `);
          await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              type TEXT NOT NULL,
              section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
              budget DOUBLE PRECISION NOT NULL DEFAULT 0
            )
          `);
          await client.query(`
            CREATE TABLE IF NOT EXISTS entries (
              id TEXT PRIMARY KEY,
              date DATE NOT NULL,
              type TEXT NOT NULL,
              category_id TEXT NULL REFERENCES categories(id) ON DELETE SET NULL,
              category TEXT NOT NULL,
              description TEXT NOT NULL,
              amount DOUBLE PRECISION NOT NULL,
              payment_method TEXT NOT NULL
            )
          `);
          await client.query(`
            CREATE TABLE IF NOT EXISTS category_budgets (
              category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
              month_key TEXT NOT NULL,
              budget DOUBLE PRECISION NOT NULL DEFAULT 0,
              changed_at TEXT NULL,
              PRIMARY KEY (category_id, month_key)
            )
          `);
          await client.query(`
            CREATE TABLE IF NOT EXISTS exchange_cache (
              id SMALLINT PRIMARY KEY CHECK (id = 1),
              rows_json JSONB NOT NULL DEFAULT '[]'::jsonb,
              fetched_at BIGINT NOT NULL DEFAULT 0,
              updated_at TEXT NULL
            )
          `);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      })();
    }

    return this.schemaReadyPromise;
  }

  async readState() {
    await this.ensureSchema();

    const [sectionsRes, categoriesRes, entriesRes, categoryBudgetsRes, exchangeRes] = await Promise.all([
      this.pool.query("SELECT id, name FROM sections ORDER BY id"),
      this.pool.query("SELECT id, name, type, section_id, budget FROM categories ORDER BY name"),
      this.pool.query("SELECT id, date::text AS date, type, category_id, category, description, amount, payment_method FROM entries ORDER BY date DESC, id DESC"),
      this.pool.query("SELECT category_id, month_key, budget, changed_at FROM category_budgets ORDER BY category_id, month_key"),
      this.pool.query("SELECT rows_json, fetched_at, updated_at FROM exchange_cache WHERE id = 1")
    ]);

    const state = {
      sections: sectionsRes.rows.map((row) => ({ id: row.id, name: row.name })),
      categories: categoriesRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        sectionId: row.section_id,
        budget: Number(row.budget) || 0
      })),
      entries: entriesRes.rows.map((row) => ({
        id: row.id,
        date: row.date,
        type: row.type,
        categoryId: row.category_id,
        category: row.category,
        description: row.description,
        amount: Number(row.amount) || 0,
        paymentMethod: row.payment_method
      })),
      categoryBudgets: categoryBudgetsRes.rows.map((row) => ({
        categoryId: row.category_id,
        monthKey: row.month_key,
        budget: Number(row.budget) || 0,
        changedAt: row.changed_at || null
      })),
      exchangeCache: exchangeRes.rowCount
        ? {
            rows: Array.isArray(exchangeRes.rows[0].rows_json) ? exchangeRes.rows[0].rows_json : [],
            fetchedAt: Number(exchangeRes.rows[0].fetched_at) || 0,
            updatedAt: exchangeRes.rows[0].updated_at || null
          }
        : { rows: [], fetchedAt: 0, updatedAt: null }
    };

    return normalizeState(state);
  }

  async writeState(nextState) {
    await this.ensureSchema();
    const state = normalizeState(nextState);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query("DELETE FROM entries");
      await client.query("DELETE FROM category_budgets");
      await client.query("DELETE FROM categories");
      await client.query("DELETE FROM sections");

      for (const section of state.sections) {
        await client.query("INSERT INTO sections (id, name) VALUES ($1, $2)", [section.id, section.name]);
      }

      for (const category of state.categories) {
        await client.query(
          "INSERT INTO categories (id, name, type, section_id, budget) VALUES ($1, $2, $3, $4, $5)",
          [category.id, category.name, category.type, category.sectionId, category.budget]
        );
      }

      for (const entry of state.entries) {
        await client.query(
          "INSERT INTO entries (id, date, type, category_id, category, description, amount, payment_method) VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)",
          [entry.id, entry.date, entry.type, entry.categoryId, entry.category, entry.description, entry.amount, entry.paymentMethod]
        );
      }

      for (const item of state.categoryBudgets || []) {
        await client.query(
          "INSERT INTO category_budgets (category_id, month_key, budget, changed_at) VALUES ($1, $2, $3, $4)",
          [item.categoryId, item.monthKey, item.budget, item.changedAt || null]
        );
      }

      await client.query(
        `
          INSERT INTO exchange_cache (id, rows_json, fetched_at, updated_at)
          VALUES (1, $1::jsonb, $2, $3)
          ON CONFLICT (id) DO UPDATE SET
            rows_json = EXCLUDED.rows_json,
            fetched_at = EXCLUDED.fetched_at,
            updated_at = EXCLUDED.updated_at
        `,
        [JSON.stringify(state.exchangeCache.rows || []), state.exchangeCache.fetchedAt || 0, state.exchangeCache.updatedAt || null]
      );

      await client.query("COMMIT");
      return state;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    await this.ensureSchema();
    await this.pool.query("SELECT 1");
    return true;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = {
  PostgresBudgetRepository
};
