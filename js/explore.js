/* ============ explore.js ============ */
(async () => {
  const meta = await App.getMeta();

  // Scale selector
  const scaleSel = document.getElementById("ctrl-scale");
  scaleSel.innerHTML = `<option value="level">Level</option><option value="yoy">Year-over-Year Change</option>`;
  const initParams = App.getParams();
  scaleSel.value = (initParams.scale === "index") ? "level" : (initParams.scale || "level");

  // Build sidebar filter panel
  await App.buildFilterPanel(document.getElementById("sidebar"), {
    showMeasure:    true,
    multiMeasure:   true,
    onFilterChange: render,
  });

  scaleSel.addEventListener("change", () => {
    App.setParams({ scale: scaleSel.value });
    render(App.getParams());
  });

  async function render(params) {
    if (!params) params = App.getParams();
    const chartWrap = document.getElementById("chart-wrap");
    App.showLoading(chartWrap);

    try {
      let data;
      let scopeLabel = "";
      let isFirmLevel = false;

      const selectedCountries  = params.country  || [];
      const selectedIndustries = params.industry || [];
      const selectedFirms      = params.firm     || [];
      const totalEntities = selectedCountries.length + selectedIndustries.length + selectedFirms.length;

      const measures = params.measures || [params.measure || "social"];
      if (totalEntities > 1 && measures.length > 1) {
        App.toast("Multiple entities + measures: use the Compare page");
      }

      if (selectedFirms.length === 1) {
        const firmIndex = await App.loadJSON("firm/index.json");
        const chunkNum  = firmIndex[selectedFirms[0]];
        if (chunkNum !== undefined) {
          const chunk = await App.loadJSON(`firm/chunk_${chunkNum}.json`);
          data = chunk[selectedFirms[0]];
          isFirmLevel = true;
          const firms = await App.getFirms();
          const firm  = firms.find(f => f.id === selectedFirms[0]);
          scopeLabel  = firm ? firm.name : selectedFirms[0];
        }
      } else if (selectedCountries.length === 1 && selectedIndustries.length === 0 && selectedFirms.length === 0) {
        data = await App.loadJSON(`agg/country/${selectedCountries[0]}.json`);
        const countries = await App.getCountries();
        const c = countries.find(x => x.code === selectedCountries[0]);
        scopeLabel = c ? c.name : selectedCountries[0];
      } else if (selectedIndustries.length === 1 && selectedCountries.length === 0 && selectedFirms.length === 0) {
        data = await App.loadJSON(`agg/industry/${selectedIndustries[0]}.json`);
        const industries = await App.getIndustries();
        const ind = industries.find(x => x.code === selectedIndustries[0]);
        scopeLabel = ind ? ind.name : selectedIndustries[0];
      } else if (totalEntities > 1) {
        App.toast("Select only one entity, or use Compare for multiple.");
        data = await App.loadJSON("agg/global.json");
        scopeLabel = "Global";
      } else {
        data = await App.loadJSON("agg/global.json");
        scopeLabel = "Global";
      }

      // Update page subtitle and slice pill
      document.getElementById("explore-subtitle").textContent = `${scopeLabel} — mean exposure over time`;
      const yearMin = params.year_min || meta.year_min;
      const yearMax = params.year_max || meta.year_max;
      const scale   = params.scale || "level";
      const measureLabels = measures.map(k => App.MEASURES[k]);

      App.updateSlicePill([
        scopeLabel,
        measureLabels.length === 1 ? measureLabels[0] : `${measureLabels.length} measures`,
        `${yearMin}–${yearMax}`,
        scale === "yoy" ? "YoY Change" : "Level",
      ]);

      let years, datasets;

      if (isFirmLevel && data) {
        const validIdx = [];
        data.years.forEach((y, i) => { if (y >= yearMin && y <= yearMax) validIdx.push(i); });
        years = validIdx.map(i => String(data.years[i]));

        if (years.length === 0) {
          _showEmpty(chartWrap, "No data in this year range for the selected firm.");
          App.hideLoading(chartWrap);
          return;
        }

        datasets = measures.map(key => {
          const raw    = validIdx.map(i => data[key] ? data[key][i] : null);
          const scaled = App.applyScale(raw, years, scale);
          return { label: App.MEASURES[key], data: scaled };
        });
      } else if (data) {
        const filtered = App.filterYears(data, yearMin, yearMax);
        years = Object.keys(filtered).sort();

        if (years.length === 0) {
          _showEmpty(chartWrap, "No data found for the current selection.");
          App.hideLoading(chartWrap);
          return;
        }

        datasets = measures.map(key => {
          const raw    = years.map(y => filtered[y]?.[key]?.[`mean`] ?? null);
          const scaled = App.applyScale(raw, years, scale);
          const metaArr = years.map(y => filtered[y]?.[key] ? { nfirm: filtered[y][key].nfirm } : null);
          return { label: App.MEASURES[key], data: scaled, meta: metaArr };
        });
      }

      // Remove any empty state
      _clearEmpty(chartWrap);
      const yLabel = scale === "yoy" ? "Year-over-Year Change" : "Mean Exposure";
      Charts.lineChart("explore-chart", { labels: years, datasets, yLabel },
        { filename: `explore_${scopeLabel.replace(/\s+/g,"_")}` });

      // Coverage bar
      if (!isFirmLevel && data) {
        const filtered = App.filterYears(data, yearMin, yearMax);
        const sortedYears = Object.keys(filtered).sort();
        const mKey = measures[0];
        const covItems = sortedYears.map(y => {
          const entry = filtered[y]?.[mKey];
          return entry ? `<span>${y}: ${entry.nfirm.toLocaleString()}</span>` : "";
        }).filter(Boolean).join("");
        document.getElementById("coverage-bar").innerHTML = covItems
          ? `<div class="coverage-title">Number of firms</div><div class="coverage-items">${covItems}</div>`
          : "";
      } else {
        document.getElementById("coverage-bar").innerHTML = "";
      }

    } catch (e) {
      console.error(e);
      App.toast("Error loading data: " + e.message);
    }

    App.hideLoading(chartWrap);
  }

  function _showEmpty(chartWrap, msg) {
    _clearEmpty(chartWrap);
    const el = document.createElement("div");
    el.className = "empty-state";
    el.id = "chart-empty-state";
    el.innerHTML = `
      <div class="empty-state-icon">&#128202;</div>
      <div class="empty-state-title">No data to display</div>
      <p>${msg || "Adjust your filters to see results."}</p>`;
    chartWrap.appendChild(el);
    const canvas = document.getElementById("explore-chart");
    if (canvas) canvas.style.display = "none";
  }

  function _clearEmpty(chartWrap) {
    const el = document.getElementById("chart-empty-state");
    if (el) el.remove();
    const canvas = document.getElementById("explore-chart");
    if (canvas) canvas.style.display = "";
  }

  render(initParams);
})();
