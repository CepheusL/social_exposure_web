/* ============ ranking.js ============ */
(async () => {
  const meta = await App.getMeta();
  const params = App.getParams();

  // Populate controls
  const entitySel = document.getElementById("ctrl-entity");
  const measureSel = document.getElementById("ctrl-measure");
  const modeSel = document.getElementById("ctrl-mode");
  const yearSel = document.getElementById("ctrl-year");
  const periodStart = document.getElementById("ctrl-period-start");
  const periodEnd = document.getElementById("ctrl-period-end");
  const directionSel = document.getElementById("ctrl-direction");
  const topnInput = document.getElementById("ctrl-topn");
  const mincovInput = document.getElementById("ctrl-mincov");
  const searchInput = document.getElementById("search-entity");

  // Measures
  App.MEASURE_KEYS.forEach(k => {
    measureSel.innerHTML += `<option value="${k}" ${k === params.measure ? "selected" : ""}>${App.MEASURES[k]}</option>`;
  });

  // Years
  for (let y = meta.year_max; y >= meta.year_min; y--) {
    yearSel.innerHTML += `<option value="${y}" ${y === (params.ranking_year || meta.year_max) ? "selected" : ""}>${y}</option>`;
  }

  // Set initial values
  entitySel.value = params.entity_type || "country";
  modeSel.value = params.ranking_mode || "single";
  directionSel.value = params.direction || "top";
  topnInput.value = params.top_n || 20;
  mincovInput.value = (params.min_coverage !== undefined && params.min_coverage !== 0) ? params.min_coverage : 10;
  periodStart.value = params.period_start || meta.year_min;
  periodEnd.value = params.period_end || meta.year_max;
  periodStart.min = meta.year_min; periodStart.max = meta.year_max;
  periodEnd.min = meta.year_min; periodEnd.max = meta.year_max;
  searchInput.value = params.search_entity || "";

  function toggleModeControls() {
    const isSingle = modeSel.value === "single";
    document.getElementById("year-controls").style.display = isSingle ? "" : "none";
    document.getElementById("period-controls").style.display = isSingle ? "none" : "";
  }
  toggleModeControls();
  modeSel.addEventListener("change", () => { toggleModeControls(); updateAndRender(); });

  let currentData = [];
  let allSortedEntries = []; // Full sorted list for search beyond range

  function updateAndRender() {
    App.setParams({
      entity_type: entitySel.value,
      measure: measureSel.value,
      ranking_mode: modeSel.value,
      ranking_year: +yearSel.value,
      direction: directionSel.value,
      top_n: +topnInput.value,
      min_coverage: +mincovInput.value,
      period_start: +periodStart.value,
      period_end: +periodEnd.value,
      search_entity: searchInput.value,
    });
    render();
  }

  [entitySel, measureSel, yearSel, directionSel].forEach(el => el.addEventListener("change", updateAndRender));
  [topnInput, mincovInput, periodStart, periodEnd].forEach(el => el.addEventListener("change", updateAndRender));

  // Search: if entity is outside the current top/bottom N, show its ranking context
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (!query) {
      // Re-render normal table
      render();
      return;
    }
    renderWithSearch(query);
  });

  function renderWithSearch(query) {
    const q = query.toLowerCase();
    const tbody = document.querySelector("#ranking-table tbody");

    // Find the entity in the full sorted list
    const matchIdx = allSortedEntries.findIndex(e =>
      (e.name || e.id).toLowerCase().includes(q)
    );

    if (matchIdx === -1) {
      // Not found — just highlight in current table
      const rows = tbody.querySelectorAll("tr");
      rows.forEach(r => r.classList.remove("highlight"));
      return;
    }

    const topN = +topnInput.value || 20;
    // Check if match is within the displayed range
    if (matchIdx < topN) {
      // Already in table — just highlight
      const rows = tbody.querySelectorAll("tr");
      rows.forEach(r => r.classList.remove("highlight"));
      if (rows[matchIdx]) {
        rows[matchIdx].classList.add("highlight");
        rows[matchIdx].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Entity is outside the top/bottom N — show all entries from rank 1
    // down to the searched entity (inclusive)
    const entriesToShow = allSortedEntries.slice(0, matchIdx + 1);

    let html = entriesToShow.map((e, i) => {
      const isMatch = i === matchIdx;
      return `<tr class="${isMatch ? "highlight" : ""}">
        <td>${i + 1}</td>
        <td>${e.name || e.id}</td>
        <td>${e.val.toFixed(4)}</td>
        <td>${e.n.toLocaleString()}</td>
        <td>${e.nfirm.toLocaleString()}</td>
      </tr>`;
    }).join("");

    tbody.innerHTML = html;

    // Scroll to highlight
    const highlighted = tbody.querySelector("tr.highlight");
    if (highlighted) {
      highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    currentData = entriesToShow;
  }

  async function render() {
    const p = App.getParams();
    const measure = p.measure || "social";
    const entity = p.entity_type || "country";
    const mode = p.ranking_mode || "single";
    const direction = p.direction || "top";
    const topN = p.top_n || 20;
    const minCov = +mincovInput.value || 0;

    try {
      const rankData = await App.loadJSON(`ranking/${measure}_${entity}.json`);

      let entries;
      if (mode === "single") {
        const year = String(p.ranking_year || meta.year_max);
        entries = rankData.by_year[year] || [];
      } else {
        // Compute period average dynamically from by_year data
        const pStart = p.period_start || meta.year_min;
        const pEnd = p.period_end || meta.year_max;
        const entityMap = new Map();
        for (let y = pStart; y <= pEnd; y++) {
          const yearData = rankData.by_year[String(y)] || [];
          yearData.forEach(e => {
            if (!entityMap.has(e.id)) {
              entityMap.set(e.id, { id: e.id, name: e.name, valSum: 0, valCount: 0, n: 0, nfirm: 0 });
            }
            const rec = entityMap.get(e.id);
            rec.valSum += e.val;
            rec.valCount++;
            rec.n += e.n;
            rec.nfirm = Math.max(rec.nfirm, e.nfirm);
          });
        }
        entries = Array.from(entityMap.values()).map(rec => ({
          id: rec.id, name: rec.name,
          val: rec.valSum / rec.valCount,
          n: rec.n, nfirm: rec.nfirm,
        }));
      }

      // Filter by min coverage
      entries = entries.filter(e => e.n >= minCov);

      // Sort
      if (direction === "top") {
        entries.sort((a, b) => b.val - a.val);
      } else {
        entries.sort((a, b) => a.val - b.val);
      }

      // Store full sorted list for search
      allSortedEntries = entries;

      // Slice for display
      const displayed = entries.slice(0, topN);
      currentData = displayed;

      // Render table
      const tbody = document.querySelector("#ranking-table tbody");
      if (displayed.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No data available</td></tr>';
        return;
      }

      tbody.innerHTML = displayed.map((e, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${e.name || e.id}</td>
          <td>${e.val.toFixed(4)}</td>
          <td>${e.n.toLocaleString()}</td>
          <td>${e.nfirm.toLocaleString()}</td>
        </tr>
      `).join("");

      // Re-apply search if active
      if (searchInput.value.trim()) {
        renderWithSearch(searchInput.value.trim());
      }

    } catch (e) {
      console.error(e);
      App.toast("Error loading ranking: " + e.message);
    }
  }

  // CSV Export
  document.getElementById("btn-export").addEventListener("click", () => {
    if (currentData.length === 0) { App.toast("No data to export"); return; }
    const headers = ["Rank", "ID", "Name", "Value", "Observations", "Firms"];
    const rows = currentData.map((e, i) => [i + 1, e.id, `"${e.name || e.id}"`, e.val, e.n, e.nfirm]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ranking_${measureSel.value}_${entitySel.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  render();
})();
