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

let appState = null;

newCategoryType.addEventListener("change", renderAdminSelects);
categorySectionFilter.addEventListener("change", renderExpenseCategorySelects);

addCategoryBtn.addEventListener("click", async () => {
  const name = newCategoryName.value.trim();
  const type = newCategoryType.value;
  const sectionId = newCategorySection.value;

  await withApiHandling(async () => {
    await window.BudgetApi.createCategory({ name, type, sectionId });
    newCategoryName.value = "";
    setCategoryMessage("Category added.");
    await reload();
  });
});

addSectionBtn.addEventListener("click", async () => {
  const name = newSectionName.value.trim();

  await withApiHandling(async () => {
    await window.BudgetApi.createSection(name);
    newSectionName.value = "";
    setSectionMessage("Section added.");
    await reload();
  });
});

removeSectionBtn.addEventListener("click", async () => {
  const sectionId = removeSectionSelect.value;

  await withApiHandling(async () => {
    await window.BudgetApi.deleteSection(sectionId);
    setSectionMessage("Section removed.");
    await reload();
  });
});

renameCategoryBtn.addEventListener("click", async () => {
  const categoryId = categoryManageSelect.value;
  const name = renameCategoryInput.value.trim();

  await withApiHandling(async () => {
    await window.BudgetApi.updateCategory(categoryId, { name });
    renameCategoryInput.value = "";
    setCategoryMessage("Category renamed.");
    await reload();
  });
});

removeCategoryBtn.addEventListener("click", async () => {
  const categoryId = removeCategorySelect.value;

  await withApiHandling(async () => {
    const result = await window.BudgetApi.deleteCategory(categoryId);
    if (result && result.fallbackCategoryName) {
      setCategoryMessage(`Category removed. Existing expenses moved to "${result.fallbackCategoryName}".`);
    } else {
      setCategoryMessage("Category removed.");
    }
    await reload();
  });
});

function renderAdminSelects() {
  if (!appState) {
    return;
  }

  const typeForNewCategory = newCategoryType.value;
  const incomeSection = appState.sections.find((section) => section.id === "income" || section.name.toLowerCase().includes("income"));

  const possibleSections = appState.sections.filter((section) => {
    if (typeForNewCategory === "income") {
      return incomeSection ? section.id === incomeSection.id : true;
    }
    return !incomeSection || section.id !== incomeSection.id;
  });

  newCategorySection.innerHTML = "";
  possibleSections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    newCategorySection.appendChild(option);
  });

  removeSectionSelect.innerHTML = "";
  appState.sections.forEach((section) => {
    const count = appState.categories.filter((category) => category.sectionId === section.id).length;
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = `${section.name} (${count})`;
    removeSectionSelect.appendChild(option);
  });

  const currentFilter = categorySectionFilter.value;
  categorySectionFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Sections";
  categorySectionFilter.appendChild(allOption);

  appState.sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.name;
    categorySectionFilter.appendChild(option);
  });

  categorySectionFilter.value = currentFilter && [...categorySectionFilter.options].some((option) => option.value === currentFilter)
    ? currentFilter
    : "all";

  renderExpenseCategorySelects();
}

function renderExpenseCategorySelects() {
  if (!appState) {
    return;
  }

  const sectionFilter = categorySectionFilter.value || "all";
  const expenseCategories = appState.categories
    .filter((category) => category.type === "expense" && (sectionFilter === "all" || category.sectionId === sectionFilter))
    .sort((a, b) => a.name.localeCompare(b.name));

  categoryManageSelect.innerHTML = "";
  removeCategorySelect.innerHTML = "";

  expenseCategories.forEach((category) => {
    const section = appState.sections.find((item) => item.id === category.sectionId);
    const label = `${category.name} (${section ? section.name : category.sectionId})`;

    const optionA = document.createElement("option");
    optionA.value = category.id;
    optionA.textContent = label;

    const optionB = document.createElement("option");
    optionB.value = category.id;
    optionB.textContent = label;

    categoryManageSelect.appendChild(optionA);
    removeCategorySelect.appendChild(optionB);
  });

  if (expenseCategories.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No expense categories in selected section";
    categoryManageSelect.appendChild(empty.cloneNode(true));
    removeCategorySelect.appendChild(empty);
  }
}

async function reload() {
  const now = new Date();
  appState = await window.BudgetApi.getBootstrap(now.getFullYear(), now.getMonth() + 1);
  renderAdminSelects();
}

async function withApiHandling(action) {
  try {
    await action();
  } catch (error) {
    if (String(error.message || "").toLowerCase().includes("section")) {
      setSectionMessage(error.message);
    } else {
      setCategoryMessage(error.message);
    }
  }
}

function setSectionMessage(message) {
  sectionMessage.textContent = message;
}

function setCategoryMessage(message) {
  categoryMessage.textContent = message;
}

reload().catch((error) => {
  setCategoryMessage(error.message);
});
