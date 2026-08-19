(() => {
  const configEl = document.getElementById("email-toolbar-config");
  if (!configEl) return;

  const CONFIG = JSON.parse(configEl.textContent);
  const DEFAULT_COLUMNS = CONFIG.columns.map((column) => column.key);
  const DEFAULT_SEARCH_FROM = CONFIG.searchFrom.map((field) => field.value);
  const COLUMN_MIN_WIDTHS = {
    email: 220,
    source: 160,
    category: 140,
    sentWhen: 260,
    setting: 180,
    cta: 180,
    preview: 120,
  };
  const ICONS = {
    search:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    grid:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
    sort:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>',
    filter:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    x:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    up:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
    down:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
  };

  const table = document.getElementById("email-table");
  const tbody = table?.querySelector("tbody");
  const emptyRow = document.getElementById("empty-row");
  const resultCount = document.getElementById("result-count");
  const searchInput = document.getElementById("email-search");
  const searchClear = document.getElementById("search-clear");
  const searchFromWrap = document.getElementById("search-from-wrap");
  const searchFromBtn = document.getElementById("search-from-btn");
  const searchFromLabel = document.getElementById("search-from-label");
  const searchFromMenu = document.getElementById("search-from-menu");
  const viewMenu = document.getElementById("view-menu");
  const sortMenu = document.getElementById("sort-menu");
  const filterMenu = document.getElementById("filter-menu");
  const viewBadge = document.getElementById("view-badge");
  const sortBadge = document.getElementById("sort-badge");
  const filterBadge = document.getElementById("filter-badge");
  const viewBtn = document.getElementById("view-btn");
  const sortBtn = document.getElementById("sort-btn");
  const filterBtn = document.getElementById("filter-btn");
  const viewWrap = document.getElementById("view-wrap");
  const sortWrap = document.getElementById("sort-wrap");
  const filterWrap = document.getElementById("filter-wrap");
  if (
    !table ||
    !tbody ||
    !emptyRow ||
    !resultCount ||
    !searchInput ||
    !searchClear ||
    !searchFromWrap ||
    !searchFromBtn ||
    !searchFromLabel ||
    !searchFromMenu ||
    !viewMenu ||
    !sortMenu ||
    !filterMenu ||
    !viewBadge ||
    !sortBadge ||
    !filterBadge ||
    !viewBtn ||
    !sortBtn ||
    !filterBtn ||
    !viewWrap ||
    !sortWrap ||
    !filterWrap
  ) {
    return;
  }

  let state = parseStateFromUrl();

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function sameSet(left, right) {
    return left.length === right.length && left.every((value) => right.includes(value));
  }

  function parseList(raw, allowed) {
    if (!raw) return [];
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => allowed.has(value));
  }

  function parseStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const allowedColumns = new Set(DEFAULT_COLUMNS);
    const allowedSearchFrom = new Set(DEFAULT_SEARCH_FROM);
    const visibleColumns = parseList(params.get("cols"), allowedColumns);
    const searchFrom = parseList(params.get("from"), allowedSearchFrom);
    const sortRaw = params.get("sort");
    const filters = {};
    for (const definition of CONFIG.filters) {
      const allowed = new Set(definition.options.map((option) => option.value));
      const values = parseList(params.get(`f.${definition.key}`), allowed);
      if (values.length > 0) filters[definition.key] = values;
    }

    return {
      search: params.get("q") ?? "",
      searchFrom: searchFrom.length > 0 ? searchFrom : [...DEFAULT_SEARCH_FROM],
      visibleColumns: visibleColumns.length > 0 ? visibleColumns : [...DEFAULT_COLUMNS],
      sortBy: CONFIG.sortOptions.some((option) => option.key === sortRaw) ? sortRaw : null,
      sortDir: params.get("sortDir") === "asc" ? "asc" : "desc",
      filters,
    };
  }

  function writeStateToUrl() {
    const params = new URLSearchParams();
    const search = state.search.trim();
    if (search) params.set("q", search);
    if (!sameSet(state.searchFrom, DEFAULT_SEARCH_FROM)) {
      params.set("from", state.searchFrom.join(","));
    }
    if (state.sortBy) params.set("sort", state.sortBy);
    if (state.sortBy && state.sortDir !== "desc") params.set("sortDir", state.sortDir);
    if (!sameSet(state.visibleColumns, DEFAULT_COLUMNS)) {
      params.set("cols", state.visibleColumns.join(","));
    }
    for (const [key, values] of Object.entries(state.filters)) {
      if (Array.isArray(values) && values.length > 0) {
        params.set(`f.${key}`, values.join(","));
      }
    }
    const query = params.toString();
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== next) history.replaceState(null, "", next);
  }

  function searchValue(row, field) {
    if (field === "sentWhen") return (row.dataset.sentWhen ?? "").toLowerCase();
    return (row.dataset[field] ?? "").toLowerCase();
  }

  function sortValue(row, field) {
    if (field === "email") return row.dataset.label ?? "";
    if (field === "sentWhen") return row.dataset.sentWhen ?? "";
    return row.dataset[field] ?? "";
  }

  function rowMatchesFilters(row) {
    for (const [key, values] of Object.entries(state.filters)) {
      if (!Array.isArray(values) || values.length === 0) continue;
      const rowValue = key === "hasCta" ? row.dataset.hasCta : row.dataset[key];
      if (!values.includes(rowValue ?? "")) return false;
    }
    return true;
  }

  function columnDiffCount() {
    const current = new Set(state.visibleColumns);
    const defaults = new Set(DEFAULT_COLUMNS);
    let diff = 0;
    for (const key of new Set([...current, ...defaults])) {
      if (current.has(key) !== defaults.has(key)) diff += 1;
    }
    return diff;
  }

  function activeFilterCount() {
    return Object.values(state.filters).reduce(
      (count, values) => count + (Array.isArray(values) ? values.length : 0),
      0,
    );
  }

  function searchFromSummary() {
    if (state.searchFrom.length === DEFAULT_SEARCH_FROM.length) return "All fields";
    if (state.searchFrom.length === 1) {
      return CONFIG.searchFrom.find((field) => field.value === state.searchFrom[0])?.label ?? "Search from";
    }
    return `${state.searchFrom.length} fields`;
  }

  function closeMenus() {
    document.querySelectorAll(".toolbar-menu.is-open, .search-from-wrap.is-open").forEach((node) => {
      node.classList.remove("is-open");
      const button = node.querySelector("[aria-expanded]");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function toggleMenu(wrap) {
    const willOpen = !wrap.classList.contains("is-open");
    closeMenus();
    if (!willOpen) return;
    wrap.classList.add("is-open");
    const button = wrap.querySelector("[aria-expanded]");
    if (button) button.setAttribute("aria-expanded", "true");
  }

  function renderCheckboxes(container, items, selected, name) {
    container.innerHTML = items
      .map((item) => {
        const checked = selected.includes(item.value) ? " checked" : "";
        const disabled =
          name === "cols" && selected.length === 1 && selected.includes(item.value) ? " disabled" : "";
        return `<label class="check-row">
          <input type="checkbox" data-group="${name}" value="${escapeHtml(item.value)}"${checked}${disabled}>
          <span>${escapeHtml(item.label)}</span>
        </label>`;
      })
      .join("");
  }

  function renderSearchFromMenu() {
    searchFromMenu.innerHTML =
      '<div class="menu-label">Search from</div><div class="menu-divider"></div>';
    const list = document.createElement("div");
    renderCheckboxes(list, CONFIG.searchFrom, state.searchFrom, "from");
    searchFromMenu.append(list);
  }

  function renderViewMenu() {
    viewMenu.innerHTML = '<div class="menu-label">Show columns</div>';
    const list = document.createElement("div");
    renderCheckboxes(
      list,
      CONFIG.columns.map((column) => ({ value: column.key, label: column.label })),
      state.visibleColumns,
      "cols",
    );
    viewMenu.append(list);
  }

  function renderSortMenu() {
    sortMenu.innerHTML = '<div class="menu-label">Sort by</div><div class="menu-divider"></div>';
    for (const option of CONFIG.sortOptions) {
      const selected = state.sortBy === option.key;
      const row = document.createElement("button");
      row.type = "button";
      row.className = `sort-row${selected ? " is-selected" : ""}`;
      row.dataset.key = option.key;
      row.innerHTML = `<span class="sort-row-label">${escapeHtml(option.label)}</span>`;
      if (selected) {
        const dir = document.createElement("span");
        dir.className = "sort-dir";
        dir.innerHTML = `${state.sortDir === "asc" ? ICONS.up : ICONS.down}<span>${state.sortDir === "asc" ? "Asc" : "Desc"}</span>`;
        row.append(dir);
      }
      sortMenu.append(row);
    }
  }

  function renderFilterMenu() {
    const count = activeFilterCount();
    const parts = ['<div class="menu-label">Filters</div>'];
    if (count > 0) {
      parts.push(
        `<button type="button" class="clear-all" id="clear-filters">Clear all ${ICONS.x}</button>`,
      );
    }
    for (const definition of CONFIG.filters) {
      parts.push(`<div class="menu-label subtle">${escapeHtml(definition.label)}</div>`);
      const selected = state.filters[definition.key] ?? [];
      parts.push(
        definition.options
          .map((option) => {
            const checked = selected.includes(option.value) ? " checked" : "";
            return `<label class="check-row">
              <input type="checkbox" data-group="filter" data-filter="${escapeHtml(definition.key)}" value="${escapeHtml(option.value)}"${checked}>
              <span>${escapeHtml(option.label)}</span>
            </label>`;
          })
          .join(""),
      );
    }
    filterMenu.innerHTML = parts.join("");
  }

  function updateBadge(button, content, visible) {
    button.hidden = !visible;
    if (visible) {
      button.querySelector(".badge-count").innerHTML = content;
    }
  }

  function updateChrome() {
    searchFromLabel.textContent = searchFromSummary();
    searchFromBtn.setAttribute("aria-label", `Search from ${searchFromSummary()}`);
    searchClear.hidden = state.search.trim().length === 0;

    const viewDiff = columnDiffCount();
    updateBadge(viewBadge, String(viewDiff), viewDiff > 0);

    const sortOption = CONFIG.sortOptions.find((option) => option.key === state.sortBy);
    if (sortOption) {
      const arrow = state.sortDir === "asc" ? ICONS.up : ICONS.down;
      updateBadge(
        sortBadge,
        `<span class="badge-sort">${escapeHtml(sortOption.label)}${arrow}</span>`,
        true,
      );
    } else {
      updateBadge(sortBadge, "", false);
    }

    const filterCount = activeFilterCount();
    updateBadge(filterBadge, String(filterCount), filterCount > 0);
  }

  function apply() {
    const rows = [...tbody.querySelectorAll("tr[data-index]")];
    const query = state.search.trim().toLowerCase();
    const matched = rows.filter((row) => {
      if (query && !state.searchFrom.some((field) => searchValue(row, field).includes(query))) {
        return false;
      }
      return rowMatchesFilters(row);
    });

    if (state.sortBy) {
      const direction = state.sortDir === "asc" ? 1 : -1;
      matched.sort((left, right) => {
        const comparison = sortValue(left, state.sortBy).localeCompare(
          sortValue(right, state.sortBy),
          "en",
          { numeric: true, sensitivity: "base" },
        );
        return comparison === 0
          ? Number(left.dataset.index) - Number(right.dataset.index)
          : comparison * direction;
      });
    } else {
      matched.sort((left, right) => Number(left.dataset.index) - Number(right.dataset.index));
    }

    for (const row of rows) row.hidden = true;
    for (const row of matched) {
      row.hidden = false;
      tbody.append(row);
    }

    emptyRow.hidden = matched.length > 0;
    emptyRow.querySelector("td").colSpan = Math.max(state.visibleColumns.length, 1);
    tbody.append(emptyRow);

    resultCount.textContent =
      matched.length === rows.length
        ? `${rows.length} emails`
        : `Showing ${matched.length} of ${rows.length} emails`;

    for (const column of CONFIG.columns) {
      table.classList.toggle(
        `col-hide-${column.key}`,
        !state.visibleColumns.includes(column.key),
      );
    }
    table.style.minWidth = `${state.visibleColumns.reduce(
      (sum, key) => sum + (COLUMN_MIN_WIDTHS[key] ?? 140),
      0,
    )}px`;

    renderSearchFromMenu();
    renderViewMenu();
    renderSortMenu();
    renderFilterMenu();
    updateChrome();
    writeStateToUrl();
  }

  searchFromBtn.insertAdjacentHTML("afterbegin", ICONS.search);
  viewBtn.insertAdjacentHTML("afterbegin", ICONS.grid);
  sortBtn.insertAdjacentHTML("afterbegin", ICONS.sort);
  filterBtn.insertAdjacentHTML("afterbegin", ICONS.filter);
  searchClear.innerHTML = ICONS.x;
  viewBadge.querySelector(".badge-x").innerHTML = ICONS.x;
  sortBadge.querySelector(".badge-x").innerHTML = ICONS.x;
  filterBadge.querySelector(".badge-x").innerHTML = ICONS.x;

  searchInput.value = state.search;
  apply();

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    apply();
  });
  searchClear.addEventListener("click", () => {
    state.search = "";
    searchInput.value = "";
    searchInput.focus();
    apply();
  });

  searchFromBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(searchFromWrap);
  });
  viewBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(viewWrap);
  });
  sortBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(sortWrap);
  });
  filterBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(filterWrap);
  });

  searchFromMenu.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.group !== "from") return;
    const next = input.checked
      ? [...state.searchFrom, input.value]
      : state.searchFrom.filter((value) => value !== input.value);
    if (next.length === 0) {
      input.checked = true;
      return;
    }
    state.searchFrom = DEFAULT_SEARCH_FROM.filter((value) => next.includes(value));
    apply();
  });

  viewMenu.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.group !== "cols") return;
    const next = input.checked
      ? [...state.visibleColumns, input.value]
      : state.visibleColumns.filter((value) => value !== input.value);
    if (next.length === 0) {
      input.checked = true;
      return;
    }
    state.visibleColumns = DEFAULT_COLUMNS.filter((value) => next.includes(value));
    apply();
  });

  sortMenu.addEventListener("click", (event) => {
    const row = event.target.closest(".sort-row");
    if (!row) return;
    const key = row.dataset.key;
    if (state.sortBy === key) {
      if (event.target.closest(".sort-dir")) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        apply();
      }
      return;
    }
    state.sortBy = key;
    state.sortDir = "asc";
    apply();
  });

  filterMenu.addEventListener("click", (event) => {
    if (event.target.closest("#clear-filters")) {
      state.filters = {};
      apply();
    }
  });
  filterMenu.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.group !== "filter") return;
    const key = input.dataset.filter;
    const current = state.filters[key] ?? [];
    const next = input.checked
      ? [...current, input.value]
      : current.filter((value) => value !== input.value);
    const filters = { ...state.filters };
    if (next.length > 0) filters[key] = next;
    else delete filters[key];
    state.filters = filters;
    apply();
  });

  viewBadge.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.visibleColumns = [...DEFAULT_COLUMNS];
    apply();
  });
  sortBadge.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.sortBy = null;
    state.sortDir = "desc";
    apply();
  });
  filterBadge.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.filters = {};
    apply();
  });

  for (const menu of [searchFromMenu, viewMenu, sortMenu, filterMenu]) {
    menu.addEventListener("click", (event) => event.stopPropagation());
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.isConnected) return;
    if (target.closest(".toolbar-menu.is-open, .search-from-wrap.is-open")) return;
    closeMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenus();
  });
})();
