/* ============ ranking.js ============ */
(async () => {
  const meta   = await App.getMeta();
  const params = App.getParams();

  const entitySel   = document.getElementById("ctrl-entity");
  const measureSel  = document.getElementById("ctrl-measure");
  const modeSel     = document.getElementById("ctrl-mode");
  const yearSel     = document.getElementById("ctrl-year");
  const periodStart = document.getElementById("ctrl-period-start");
  const periodEnd   = document.getElementById("ctrl-period-end");
  const directionSel = document.getElementById("ctrl-direction");
  const topnInput   = document.getElementById("ctrl-topn");
  const mincovInput = document.getElementById("ctrl-mincov");
  const searchInput = document.getElementById("search-entity");

  // Populate measures
  App.MEASURE_KEYS.forEach(k => {
    measureSel.innerHTML += `<option value="${k}" ${k === params.measure ? "selected" : ""}>${App.MEASURES[k]}</option>`;
  });

  // Populate years
  for (let y = meta.year_max; y >= meta.year_min; y--) {
    yearSel.innerHTML += `<option value="${y}" ${y === (params.ranking_year || meta.year_max) ? "selected" : ""}>${y}</option>`;
  }

  entitySel.value    = params.entity_type    || "country";
  modeSel.value      = params.ranking_mode   || "single";
  directionSel.value = params.direction      || "top";
  topnInput.value    = params.top_n          || 20;
  mincovInput.value  = (params.min_coverage !== undefined && params.min_coverage !== 0) ? params.min_coverage : 10;
  periodStart.value  = params.period_start   || meta.year_min;
  periodEnd.value    = params.period_end     || meta.year_max;
  periodStart.min = meta.year_min; periodStart.max = meta.year_max;
  periodEnd.min   = meta.year_min; periodEnd.max   = meta.year_max;
  searchInput.value  = params.search_entity  || "";

  function toggleModeControls() {
    const isSingle = modeSel.value === "single";
    document.getElementById("year-controls").style.display   = isSingle ? "" : "none";
    document.getElementById("period-controls").style.display = isSingle ? "none" : "";
  }
  toggleModeControls();
  modeSel.addEventListener("change", () => { toggleModeControls(); updateAndRender(); });

  let allSortedEntries = [];
  let currentData      = [];

  function updateStickyBar() {
    const p     = App.getParams();
    const topN  = +topnInput.value || 20;
    const dir   = directionSel.value === "top" ? "Top" : "Bottom";
    const etype = { country:"Countries", industry:"Industries", firm:"Firms" }[entitySel.value] || entitySel.value;
    const mname = App.MEASURES[measureSel.value] || measureSel.value;
    const isSingle = modeSel.value === "single";
    const period = isSingle
      ? String(yearSel.value)
      : `${periodStart.value}–${periodEnd.value}`;

    document.getElementById("rsb-direction").textContent = `${dir} ${topN}`;
    document.getElementById("rsb-entity").textContent    = etype;
    document.getElementById("rsb-measure").textContent   = mname;
    document.getElementById("rsb-period").textContent    = period;
    document.getElementById("rsb-minobs").textContent    = mincovInput.value;
  }

  function updateAndRender() {
    App.setParams({
      entity_type:   entitySel.value,
      measure:       measureSel.value,
      ranking_mode:  modeSel.value,
      ranking_year:  +yearSel.value,
      direction:     directionSel.value,
      top_n:         +topnInput.value,
      min_coverage:  +mincovInput.value,
      period_start:  +periodStart.value,
      period_end:    +periodEnd.value,
      search_entity: searchInput.value,
    });
    render();
  }

  [entitySel, measureSel, yearSel, directionSel].forEach(el => el.addEventListener("change", updateAndRender));
  [topnInput, mincovInput, periodStart, periodEnd].forEach(el => el.addEventListener("change", updateAndRender));

  // Search
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (!query) { render(); return; }
    renderWithSearch(query);
  });

  function renderWithSearch(query) {
    const q     = query.toLowerCase();
    const tbody = document.querySelector("#ranking-table tbody");

    const matchIdx = allSortedEntries.findIndex(e =>
      (e.name || e.id).toLowerCase().includes(q)
    );

    if (matchIdx === -1) {
      tbody.querySelectorAll("tr").forEach(r => r.classList.remove("highlight"));
      return;
    }

    const topN = +topnInput.value || 20;
    if (matchIdx < topN) {
      // Already in table — just highlight row
      const rows = tbody.querySelectorAll("tr");
      rows.forEach(r => r.classList.remove("highlight"));
      if (rows[matchIdx]) {
        rows[matchIdx].classList.add("highlight");
        rows[matchIdx].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Extend table from rank 1 to searched entity
    const entriesToShow = allSortedEntries.slice(0, matchIdx + 1);
    tbody.innerHTML = entriesToShow.map((e, i) => {
      const isMatch = i === matchIdx;
      return `<tr class="${isMatch ? "highlight" : ""}">
        <td>${i + 1}</td>
        <td>${e.name || e.id}</td>
        <td>${e.val.toFixed(4)}</td>
        <td>${e.n.toLocaleString()}</td>
        <td>${e.nfirm.toLocaleString()}</td>
      </tr>`;
    }).join("");

    const highlighted = tbody.querySelector("tr.highlight");
    if (highlighted) highlighted.scrollIntoView({ behavior: "smooth", block: "center" });

    currentData = entriesToShow;
  }

  async function render() {
    const p       = App.getParams();
    const measure = p.measure     || "social";
    const entity  = p.entity_type || "country";
    const mode    = p.ranking_mode || "single";
    const direction = p.direction || "top";
    const topN    = p.top_n || 20;
    const minCov  = +mincovInput.value || 0;

    try {
      const rankData = await App.loadJSON(`ranking/${measure}_${entity}.json`);

      let entries;
      if (mode === "single") {
        const year = String(p.ranking_year || meta.year_max);
        entries = rankData.by_year[year] || [];
      } else {
        const pStart = p.period_start || meta.year_min;
        const pEnd   = p.period_end   || meta.year_max;
        const entityMap = new Map();
        for (let y = pStart; y <= pEnd; y++) {
          const yearData = rankData.by_year[String(y)] || [];
          yearData.forEach(e => {
            if (!entityMap.has(e.id)) {
              entityMap.set(e.id, { id:e.id, name:e.name, valSum:0, valCount:0, n:0, nfirm:0 });
            }
            const rec = entityMap.get(e.id);
            rec.valSum += e.val; rec.valCount++;
            rec.n += e.n; rec.nfirm = Math.max(rec.nfirm, e.nfirm);
          });
        }
        entries = Array.from(entityMap.values()).map(rec => ({
          id:rec.id, name:rec.name,
          val: rec.valSum / rec.valCount,
          n:rec.n, nfirm:rec.nfirm,
        }));
      }

      entries = entries.filter(e => e.n >= minCov);
      if (direction === "top") entries.sort((a,b) => b.val - a.val);
      else                      entries.sort((a,b) => a.val - b.val);

      allSortedEntries = entries;
      const displayed  = entries.slice(0, topN);
      currentData      = displayed;

      updateStickyBar();

      const tbody = document.querySelector("#ranking-table tbody");
      if (displayed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">
          No data matches the current filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = displayed.map((e, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${e.name || e.id}</td>
          <td>${e.val.toFixed(4)}</td>
          <td>${e.n.toLocaleString()}</td>
          <td>${e.nfirm.toLocaleString()}</td>
        </tr>`).join("");

      if (searchInput.value.trim()) {
        renderWithSearch(searchInput.value.trim());
      }

    } catch(e) {
      console.error(e); App.toast("Error loading ranking: " + e.message);
    }
  }

  // CSV export
  document.getElementById("btn-export-csv").addEventListener("click", () => {
    if (currentData.length === 0) { App.toast("No data to export"); return; }
    const headers = ["Rank","ID","Name","Value","Observations","Firms"];
    const rows    = currentData.map((e, i) => [i+1, e.id, `"${e.name || e.id}"`, e.val, e.n, e.nfirm]);
    const csv     = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob    = new Blob([csv], { type:"text/csv" });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement("a");
    a.href = url; a.download = `ranking_${measureSel.value}_${entitySel.value}.csv`;
    a.click(); URL.revokeObjectURL(url);
    App.toast("CSV downloaded");
  });

  // PNG export — render visible table rows as canvas image
  document.getElementById("btn-export-img").addEventListener("click", () => {
    const table = document.getElementById("ranking-table");
    if (!table || currentData.length === 0) { App.toast("No data to export"); return; }

    const rows = currentData.length;
    const cols = 5;
    const rowH = 30, headerH = 36, colWidths = [50, 260, 90, 90, 80];
    const totalW = colWidths.reduce((a,b) => a+b, 0);
    const totalH = headerH + rows * rowH + 20;

    const canvas = document.createElement("canvas");
    canvas.width  = totalW + 40;
    canvas.height = totalH + 40;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#faf9f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = "#141413";
    ctx.font = "bold 13px Poppins, Arial, sans-serif";
    ctx.fillText(
      `${App.MEASURES[measureSel.value]} — ${entitySel.value}s ranking`,
      20, 26
    );

    // Header row
    const headers = ["#","Name","Value","Obs","Firms"];
    let x = 20;
    ctx.fillStyle = "#e8e6dc";
    ctx.fillRect(20, 36, totalW, headerH);
    ctx.fillStyle = "#b0aea5";
    ctx.font = "bold 11px Poppins, Arial, sans-serif";
    headers.forEach((h, i) => {
      ctx.fillText(h, x + 6, 36 + headerH / 2 + 4);
      x += colWidths[i];
    });

    // Data rows
    currentData.forEach((e, rowIdx) => {
      const y = 36 + headerH + rowIdx * rowH;
      ctx.fillStyle = rowIdx % 2 === 0 ? "#ffffff" : "#faf9f5";
      ctx.fillRect(20, y, totalW, rowH);

      const vals = [rowIdx+1, e.name||e.id, e.val.toFixed(4), e.n.toLocaleString(), e.nfirm.toLocaleString()];
      ctx.fillStyle = "#141413";
      ctx.font = "12px Lora, Georgia, serif";
      x = 20;
      vals.forEach((v, i) => {
        ctx.fillText(String(v).slice(0, i===1 ? 32 : 20), x + 6, y + rowH/2 + 4);
        x += colWidths[i];
      });
    });

    // Grid lines
    ctx.strokeStyle = "#e8e6dc";
    ctx.lineWidth   = 0.5;
    let lx = 20;
    colWidths.forEach(w => {
      lx += w;
      ctx.beginPath();
      ctx.moveTo(lx, 36);
      ctx.lineTo(lx, 36 + headerH + rows * rowH);
      ctx.stroke();
    });

    const url = canvas.toDataURL("image/png");
    const a   = document.createElement("a");
    a.href = url; a.download = `ranking_${measureSel.value}_${entitySel.value}.png`;
    a.click();
    App.toast("PNG downloaded");
  });

  // Copy link
  document.getElementById("btn-copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href).then(() => App.toast("Link copied!"));
  });

  render();
})();
