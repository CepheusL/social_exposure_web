/* ============ explore.js ============ */
(async () => {
  const meta = await App.getMeta();

  // Scale control (no index option)
  const scaleSel = document.getElementById("ctrl-scale");
  scaleSel.innerHTML = `<option value="level">Level</option><option value="yoy">Year-over-Year Change</option>`;

  const initParams = App.getParams();
  scaleSel.value = (initParams.scale === "index") ? "level" : (initParams.scale || "level");

  // Build filter panel (multi-measure, single-select entities)
  await App.buildFilterPanel(document.getElementById("sidebar"), {
    showMeasure: true,
    multiMeasure: true,
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
      let subtitle = "";
      let isFirmLevel = false;

      const selectedCountries = params.country || [];
      const selectedIndustries = params.industry || [];
      const selectedFirms = params.firm || [];
      const totalEntities = selectedCountries.length + selectedIndustries.length + selectedFirms.length;

      const measures = params.measures || [params.measure || "social"];
      if (totalEntities > 1 && measures.length > 1) {
        App.toast("Multiple entities with multiple measures: please use the Compare page");
      }

      if (selectedFirms.length === 1) {
        const firmIndex = await App.loadJSON("firm/index.json");
        const chunkNum = firmIndex[selectedFirms[0]];
        if (chunkNum !== undefined) {
          const chunk = await App.loadJSON(`firm/chunk_${chunkNum}.json`);
          data = chunk[selectedFirms[0]];
          isFirmLevel = true;
          const firms = await App.getFirms();
          const firm = firms.find(f => f.id === selectedFirms[0]);
          subtitle = `Firm: ${firm ? firm.name : selectedFirms[0]}`;
        }
      } else if (selectedCountries.length === 1 && selectedIndustries.length === 0 && selectedFirms.length === 0) {
        data = await App.loadJSON(`agg/country/${selectedCountries[0]}.json`);
        const countries = await App.getCountries();
        const c = countries.find(x => x.code === selectedCountries[0]);
        subtitle = `Country: ${c ? c.name : selectedCountries[0]}`;
      } else if (selectedIndustries.length === 1 && selectedCountries.length === 0 && selectedFirms.length === 0) {
        data = await App.loadJSON(`agg/industry/${selectedIndustries[0]}.json`);
        const industries = await App.getIndustries();
        const ind = industries.find(x => x.code === selectedIndustries[0]);
        subtitle = `Industry: ${ind ? ind.name : selectedIndustries[0]}`;
      } else if (totalEntities > 1) {
        App.toast("Select only one entity to explore, or use Compare page for multiple.");
        data = await App.loadJSON("agg/global.json");
        subtitle = "Global (all firms)";
      } else {
        data = await App.loadJSON("agg/global.json");
        subtitle = "Global (all firms)";
      }

      document.getElementById("explore-subtitle").textContent = subtitle;

      const yearMin = params.year_min || meta.year_min;
      const yearMax = params.year_max || meta.year_max;
      const stat = "mean";
      const scale = params.scale || "level";

      let years, datasets;

      if (isFirmLevel && data) {
        const validIdx = [];
        data.years.forEach((y, i) => { if (y >= yearMin && y <= yearMax) validIdx.push(i); });
        years = validIdx.map(i => String(data.years[i]));

        datasets = measures.map(key => {
          const raw = validIdx.map(i => data[key] ? data[key][i] : null);
          const scaled = App.applyScale(raw, years, scale);
          return { label: App.MEASURES[key], data: scaled };
        });
      } else if (data) {
        const filtered = App.filterYears(data, yearMin, yearMax);
        years = Object.keys(filtered).sort();

        datasets = measures.map(key => {
          const raw = years.map(y => {
            const entry = filtered[y] && filtered[y][key];
            return entry ? entry[stat] : null;
          });
          const scaled = App.applyScale(raw, years, scale);
          const metaArr = years.map(y => {
            const entry = filtered[y] && filtered[y][key];
            return entry ? { nfirm: entry.nfirm } : null;
          });
          return { label: App.MEASURES[key], data: scaled, meta: metaArr };
        });
      }

      const yLabel = scale === "yoy" ? "Year-over-Year Change" : "Mean Exposure";
      Charts.lineChart("explore-chart", { labels: years, datasets, yLabel });

      // Coverage bar — only show firm count
      if (!isFirmLevel && data) {
        const filtered = App.filterYears(data, yearMin, yearMax);
        const sortedYears = Object.keys(filtered).sort();
        const mKey = measures[0];
        const covItems = sortedYears.map(y => {
          const entry = filtered[y] && filtered[y][mKey];
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

  render(initParams);
})();
