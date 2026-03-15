/* ============ compare.js ============ */
(async () => {
  const meta = await App.getMeta();
  const params = App.getParams();

  // Populate controls
  const measureSel = document.getElementById("compare-measure");
  App.MEASURE_KEYS.forEach(k => {
    measureSel.innerHTML += `<option value="${k}" ${k === params.measure ? "selected" : ""}>${App.MEASURES[k]}</option>`;
  });

  const entityType = document.getElementById("entity-type");
  entityType.value = params.entity_type || "country";

  const yminInput = document.getElementById("filter-ymin");
  const ymaxInput = document.getElementById("filter-ymax");
  yminInput.value = params.year_min || meta.year_min;
  ymaxInput.value = params.year_max || meta.year_max;
  yminInput.min = meta.year_min; yminInput.max = meta.year_max;
  ymaxInput.min = meta.year_min; ymaxInput.max = meta.year_max;

  // Entity selection (chip input — multi-select)
  const wrap = document.getElementById("entity-wrap");
  const input = document.getElementById("entity-input");
  const dropdown = document.getElementById("entity-dropdown");

  let allItems = [];
  let selected = new Set();
  let entityLookup = {};

  async function loadEntityOptions() {
    const type = entityType.value;
    if (type === "country") {
      const countries = await App.getCountries();
      allItems = countries.map(c => ({ id: c.code, label: `${c.name} (${c.code})` }));
      selected = new Set(params.country || []);
    } else if (type === "industry") {
      const industries = await App.getIndustries();
      allItems = industries.map(i => ({ id: i.code, label: `${i.name} (${i.code})` }));
      selected = new Set(params.industry || []);
    } else {
      const firms = await App.getFirms();
      allItems = firms.map(f => ({ id: f.id, label: `${f.name} (${f.id})` }));
      selected = new Set(params.firm || []);
    }
    entityLookup = {};
    allItems.forEach(it => entityLookup[it.id] = it.label);
    renderChips();
  }

  function renderChips() {
    wrap.querySelectorAll(".chip").forEach(c => c.remove());
    for (const id of selected) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${entityLookup[id] || id} <button data-id="${id}">&times;</button>`;
      wrap.insertBefore(chip, input);
    }
    wrap.querySelectorAll(".chip button").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        selected.delete(btn.dataset.id);
        renderChips();
        updateAndRender();
      });
    });
  }

  function showDropdown(filter) {
    const f = filter.toLowerCase();
    const matches = allItems.filter(it => !selected.has(it.id) && it.label.toLowerCase().includes(f)).slice(0, 50);
    dropdown.innerHTML = matches.map(m => `<div class="option" data-id="${m.id}">${m.label}</div>`).join("");
    dropdown.classList.toggle("open", matches.length > 0 && f.length > 0);
    dropdown.querySelectorAll(".option").forEach(opt => {
      opt.addEventListener("click", () => {
        selected.add(opt.dataset.id);
        input.value = "";
        dropdown.classList.remove("open");
        renderChips();
        updateAndRender();
      });
    });
  }

  input.addEventListener("input", () => showDropdown(input.value));
  input.addEventListener("focus", () => { if (input.value) showDropdown(input.value); });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) dropdown.classList.remove("open"); });

  function updateAndRender() {
    const type = entityType.value;
    const p = { entity_type: type, measure: measureSel.value,
                year_min: +yminInput.value, year_max: +ymaxInput.value };
    p.country = []; p.industry = []; p.firm = [];
    p[type] = Array.from(selected);
    App.setParams(p);
    render();
  }

  [measureSel, yminInput, ymaxInput].forEach(el => el.addEventListener("change", updateAndRender));
  entityType.addEventListener("change", () => {
    selected.clear();
    loadEntityOptions().then(updateAndRender);
  });

  document.getElementById("filter-clear").addEventListener("click", () => { window.location.search = ""; });
  document.getElementById("filter-copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href).then(() => App.toast("Link copied!"));
  });

  async function render() {
    const chartWrap = document.getElementById("chart-wrap");
    App.showLoading(chartWrap);

    try {
      const p = App.getParams();
      const measure = p.measure || "social";
      const stat = "mean";
      const yearMin = p.year_min || meta.year_min;
      const yearMax = p.year_max || meta.year_max;
      const type = p.entity_type || "country";
      const entities = Array.from(selected);

      if (entities.length === 0) {
        App.hideLoading(chartWrap);
        document.getElementById("summary-table-wrap").innerHTML = '<p style="color:var(--text-muted);padding:20px">Select entities to compare.</p>';
        return;
      }

      // Load data for each entity
      const entityData = [];
      for (const eid of entities) {
        let data;
        if (type === "country") {
          try { data = await App.loadJSON(`agg/country/${eid}.json`); } catch { data = {}; }
        } else if (type === "industry") {
          try { data = await App.loadJSON(`agg/industry/${eid}.json`); } catch { data = {}; }
        } else {
          const firmIndex = await App.loadJSON("firm/index.json");
          const chunkNum = firmIndex[eid];
          if (chunkNum !== undefined) {
            const chunk = await App.loadJSON(`firm/chunk_${chunkNum}.json`);
            data = chunk[eid];
          } else {
            data = {};
          }
        }
        entityData.push({ id: eid, name: entityLookup[eid] || eid, data });
      }

      // Build trend line chart (always trend, no snapshot)
      let allYears = new Set();
      entityData.forEach(ed => {
        if (ed.data && ed.data.years) {
          ed.data.years.forEach(y => { if (y >= yearMin && y <= yearMax) allYears.add(y); });
        } else if (ed.data) {
          Object.keys(ed.data).forEach(y => { if (+y >= yearMin && +y <= yearMax) allYears.add(+y); });
        }
      });
      const years = Array.from(allYears).sort((a, b) => a - b).map(String);

      const datasets = entityData.map((ed, i) => {
        let vals;
        if (ed.data && ed.data.years) {
          const yearMap = {};
          ed.data.years.forEach((y, idx) => { yearMap[y] = ed.data[measure] ? ed.data[measure][idx] : null; });
          vals = years.map(y => yearMap[+y] ?? null);
        } else {
          vals = years.map(y => {
            const entry = ed.data[y] && ed.data[y][measure];
            return entry ? entry[stat] : null;
          });
        }
        return { label: ed.name.split(" (")[0], data: vals };
      });

      Charts.lineChart("compare-chart", { labels: years, datasets, yLabel: "Mean Exposure" });

      // Summary table — show TOTAL obs and firms across all years (not just latest year)
      let tableHtml = '<table><thead><tr><th>Entity</th><th>Mean Value</th><th>Total Obs</th><th>Total Firms</th></tr></thead><tbody>';
      entityData.forEach(ed => {
        let totalN = 0, maxNfirm = 0, valSum = 0, valCount = 0;
        if (ed.data && ed.data.years) {
          // Firm-level: count years within range
          ed.data.years.forEach((y, idx) => {
            if (y >= yearMin && y <= yearMax && ed.data[measure] && ed.data[measure][idx] != null) {
              totalN++;
              valSum += ed.data[measure][idx];
              valCount++;
            }
          });
          maxNfirm = 1;
        } else if (ed.data) {
          // Aggregate: sum n and nfirm across all years in range
          Object.entries(ed.data).forEach(([y, ydata]) => {
            if (+y >= yearMin && +y <= yearMax && ydata[measure]) {
              totalN += ydata[measure].n || 0;
              maxNfirm = Math.max(maxNfirm, ydata[measure].nfirm || 0);
              valSum += (ydata[measure][stat] || 0) * (ydata[measure].n || 1);
              valCount += (ydata[measure].n || 1);
            }
          });
        }
        const avgVal = valCount > 0 ? (valSum / valCount).toFixed(4) : "–";
        tableHtml += `<tr><td>${ed.name.split(" (")[0]}</td><td>${avgVal}</td><td>${totalN.toLocaleString()}</td><td>${maxNfirm.toLocaleString()}</td></tr>`;
      });
      tableHtml += '</tbody></table>';
      document.getElementById("summary-table-wrap").innerHTML = tableHtml;

    } catch (e) {
      console.error(e);
      App.toast("Error: " + e.message);
    }

    App.hideLoading(chartWrap);
  }

  await loadEntityOptions();
  render();
})();
