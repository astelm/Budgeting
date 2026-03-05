const defaultSections = [
  { id: "income", name: "INCOME" },
  { id: "fixed", name: "FIXED BILLS" },
  { id: "variable", name: "VARIABLE BILLS" },
  { id: "savings", name: "SAVINGS" },
  { id: "subscriptions", name: "SUBSCRIPTIONS" },
  { id: "personal", name: "PERSONAL" }
];

const defaultCategories = [
  { name: "Paycheck1", type: "income", sectionId: "income", budget: 2500 },
  { name: "Paycheck2", type: "income", sectionId: "income", budget: 2500 },
  { name: "Gift", type: "income", sectionId: "income", budget: 0 },
  { name: "Rent", type: "expense", sectionId: "fixed", budget: 1200 },
  { name: "Internet", type: "expense", sectionId: "fixed", budget: 80 },
  { name: "Phone", type: "expense", sectionId: "fixed", budget: 55 },
  { name: "Groceries", type: "expense", sectionId: "variable", budget: 550 },
  { name: "Gas", type: "expense", sectionId: "variable", budget: 220 },
  { name: "Dining Out", type: "expense", sectionId: "variable", budget: 220 },
  { name: "Entertainment", type: "expense", sectionId: "variable", budget: 170 },
  { name: "Other", type: "expense", sectionId: "variable", budget: 140 },
  { name: "Emergency Fund", type: "expense", sectionId: "savings", budget: 300 },
  { name: "Retirement", type: "expense", sectionId: "savings", budget: 300 },
  { name: "Netflix", type: "expense", sectionId: "subscriptions", budget: 16 },
  { name: "YouTube", type: "expense", sectionId: "subscriptions", budget: 13 },
  { name: "Education", type: "expense", sectionId: "personal", budget: 160 },
  { name: "Gifts", type: "expense", sectionId: "personal", budget: 130 }
];

const keys = {
  entries: "budget_tracker_entries_v2",
  categories: "budget_tracker_categories_v2",
  sections: "budget_tracker_sections_v3"
};

const addCategoryBtn = document.getElementById("addCategoryBtn");
const newCategoryName = document.getElementById("newCategoryName");
const newCategoryType = document.getElementById("newCategoryType");
const newCategorySection = document.getElementById("newCategorySection");
const categorySectionFilter = document.getElementById("categorySectionFilter");

const newSectionName = document.getElementById("newSectionName");
const addSectionBtn = document.getElementById("addSectionBtn");
const removeSectionSelect = document.getElementById("removeSectionSelect");
const removeSectionBtn = document.getElementById("removeSectionBtn");

const categoryManageSelect = document.getElementById("categoryManageSelect");
const renameCategoryInput = document.getElementById("renameCategoryInput");
const renameCategoryBtn = document.getElementById("renameCategoryBtn");
const removeCategorySelect = document.getElementById("removeCategorySelect");
const removeCategoryBtn = document.getElementById("removeCategoryBtn");

const sectionMessage = document.getElementById("sectionMessage");
const categoryMessage = document.getElementById("categoryMessage");

let entries = load(keys.entries, []);
let sections = load(keys.sections, defaultSections);
let categories = normalizeCategories(load(keys.categories, defaultCategories));

migrateLegacyCategories();
renderAdminSelects();

newCategoryType.addEventListener("change", renderAdminSelects);
categorySectionFilter.addEventListener("change", renderExpenseCategorySelects);

addCategoryBtn.addEventListener("click", () => {
  const name = newCategoryName.value.trim();
  const type = newCategoryType.value;
  let sectionId = newCategorySection.value;

  if (!name) {
    setCategoryMessage("Category name is required.");
    return;
  }

  if (!sectionId) {
    sectionId = type === "income" ? findSectionIdByName("income") : findSectionIdByName("variable");
  }

  const exists = categories.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.type === type);
  if (exists) {
    setCategoryMessage("Category with this name already exists for the selected type.");
    return;
  }

  categories.push({ name, type, sectionId, budget: 0 });
  categories.sort((a, b) => a.name.localeCompare(b.name));
  save(keys.categories, categories);
  newCategoryName.value = "";
  setCategoryMessage("Category added.");
  renderAdminSelects();
});

addSectionBtn.addEventListener("click", () => {
  const name = newSectionName.value.trim();
  if (!name) {
    setSectionMessage("Section name is required.");
    return;
  }

  const exists = sections.some((s) => s.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    setSectionMessage("Section with this name already exists.");
    return;
  }

  sections.push({ id: slugify(name), name: name.toUpperCase() });
  save(keys.sections, sections);
  newSectionName.value = "";
  setSectionMessage("Section added.");
  renderAdminSelects();
});

removeSectionBtn.addEventListener("click", () => {
  const sectionId = removeSectionSelect.value;
  if (!sectionId) {
    setSectionMessage("Select a section to remove.");
    return;
  }

  if (categories.some((c) => c.sectionId === sectionId)) {
    setSectionMessage("Cannot remove section with existing categories.");
    return;
  }

  sections = sections.filter((s) => s.id !== sectionId);
  save(keys.sections, sections);
  setSectionMessage("Section removed.");
  renderAdminSelects();
});

renameCategoryBtn.addEventListener("click", () => {
  const selected = categoryManageSelect.value;
  const newName = renameCategoryInput.value.trim();
  if (!selected || !newName) {
    setCategoryMessage("Select a category and provide a new name.");
    return;
  }

  const category = findExpenseCategoryByToken(selected);
  if (!category) {
    setCategoryMessage("Category not found.");
    return;
  }

  const conflict = categories.some((c) => c !== category && c.type === "expense" && c.name.toLowerCase() === newName.toLowerCase());
  if (conflict) {
    setCategoryMessage("Expense category with this name already exists.");
    return;
  }

  const oldName = category.name;
  category.name = newName;
  entries = entries.map((entry) => (entry.type === "expense" && entry.category === oldName ? { ...entry, category: newName } : entry));

  save(keys.categories, categories);
  save(keys.entries, entries);
  renameCategoryInput.value = "";
  setCategoryMessage("Category renamed.");
  renderAdminSelects();
});

removeCategoryBtn.addEventListener("click", () => {
  const selected = removeCategorySelect.value;
  if (!selected) {
    setCategoryMessage("Select a category to remove.");
    return;
  }

  const category = findExpenseCategoryByToken(selected);
  if (!category) {
    setCategoryMessage("Category not found.");
    return;
  }

  const fallback = ensureFallbackExpenseCategory(category.sectionId);
  if (fallback && fallback.name === category.name && categories.filter((c) => c.type === "expense").length === 1) {
    setCategoryMessage("At least one expense category must remain.");
    return;
  }

  categories = categories.filter((c) => !(c.type === "expense" && c.name === category.name && c.sectionId === category.sectionId));
  entries = entries.map((entry) => (entry.type === "expense" && entry.category === category.name ? { ...entry, category: fallback.name } : entry));

  save(keys.categories, categories);
  save(keys.entries, entries);
  setCategoryMessage(`Category removed. Existing expenses moved to "${fallback.name}".`);
  renderAdminSelects();
});

function renderAdminSelects() {
  const typeForNewCategory = newCategoryType.value;
  const possibleSections = sections.filter((section) => {
    const wantsIncome = typeForNewCategory === "income";
    const isIncomeSection = section.id === findSectionIdByName("income") || section.name.toLowerCase().includes("income");
    return wantsIncome ? isIncomeSection : !isIncomeSection;
  });

  newCategorySection.innerHTML = "";
  possibleSections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    newCategorySection.appendChild(option);
  });

  removeSectionSelect.innerHTML = "";
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = `${section.name} (${categories.filter((c) => c.sectionId === section.id).length})`;
    removeSectionSelect.appendChild(option);
  });

  const currentFilter = categorySectionFilter.value;
  categorySectionFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Sections";
  categorySectionFilter.appendChild(allOption);

  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    categorySectionFilter.appendChild(option);
  });

  categorySectionFilter.value = currentFilter && [...categorySectionFilter.options].some((o) => o.value === currentFilter)
    ? currentFilter
    : "all";

  renderExpenseCategorySelects();
}

function renderExpenseCategorySelects() {
  const sectionFilter = categorySectionFilter.value || "all";
  const expenseCategories = categories
    .filter((c) => c.type === "expense" && (sectionFilter === "all" || c.sectionId === sectionFilter))
    .sort((a, b) => a.name.localeCompare(b.name));

  categoryManageSelect.innerHTML = "";
  removeCategorySelect.innerHTML = "";

  expenseCategories.forEach((category) => {
    const section = sections.find((s) => s.id === category.sectionId);
    const token = `${category.sectionId}::${category.name}`;
    const label = `${category.name} (${section ? section.name : category.sectionId})`;

    const o1 = document.createElement("option");
    o1.value = token;
    o1.textContent = label;

    const o2 = document.createElement("option");
    o2.value = token;
    o2.textContent = label;

    categoryManageSelect.appendChild(o1);
    removeCategorySelect.appendChild(o2);
  });

  if (expenseCategories.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No expense categories in selected section";
    categoryManageSelect.appendChild(empty.cloneNode(true));
    removeCategorySelect.appendChild(empty);
  }
}

function findExpenseCategoryByToken(token) {
  const [sectionId, name] = token.split("::");
  return categories.find((c) => c.type === "expense" && c.sectionId === sectionId && c.name === name);
}

function ensureFallbackExpenseCategory(sectionId) {
  let fallback = categories.find((c) => c.type === "expense" && c.sectionId === sectionId && c.name === "Other");
  if (fallback) return fallback;

  fallback = { name: "Other", type: "expense", sectionId: sectionId || findSectionIdByName("variable"), budget: 0 };
  categories.push(fallback);
  save(keys.categories, categories);
  return fallback;
}

function findSectionIdByName(hint) {
  const found = sections.find((s) => s.id === hint || s.name.toLowerCase().includes(hint.toLowerCase()));
  return found ? found.id : (sections[0] ? sections[0].id : "");
}

function migrateLegacyCategories() {
  categories = categories.map((c) => (c.sectionId ? c : { ...c, sectionId: c.group || findSectionIdByName("variable") }));
  save(keys.categories, categories);
}

function normalizeCategories(list) {
  return list.map((item) => ({ ...item, budget: Number(item.budget) || 0 }));
}

function slugify(value) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "section";
  let candidate = base;
  let i = 1;
  while (sections.some((s) => s.id === candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

function setSectionMessage(message) {
  sectionMessage.textContent = message;
}

function setCategoryMessage(message) {
  categoryMessage.textContent = message;
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
