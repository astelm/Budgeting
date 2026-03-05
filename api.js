async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    const message = data && data.error ? data.error.message : "Request failed.";
    throw new Error(message);
  }

  return data;
}

window.BudgetApi = {
  getBootstrap(year, month) {
    return requestJson(`/api/bootstrap?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
  },

  createEntry(payload) {
    return requestJson("/api/entries", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  deleteEntry(id) {
    return requestJson(`/api/entries/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  updateCategoryBudget(id, budget, monthKey) {
    return requestJson(`/api/categories/${encodeURIComponent(id)}/budget`, {
      method: "PATCH",
      body: JSON.stringify({ budget, monthKey })
    });
  },

  createCategory(payload) {
    return requestJson("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  updateCategory(id, payload) {
    return requestJson(`/api/categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },

  deleteCategory(id) {
    return requestJson(`/api/categories/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  createSection(name) {
    return requestJson("/api/sections", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  deleteSection(id) {
    return requestJson(`/api/sections/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
  },

  refreshExchangeRates() {
    return requestJson("/api/exchange-rates/refresh", {
      method: "POST",
      body: JSON.stringify({})
    });
  }
};
