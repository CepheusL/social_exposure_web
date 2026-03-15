/* ============ app.js — Shared core: URL state, data loader, filter panel ============ */

const App = (() => {
  // --- Constants ---
  const MEASURES = {
    emp: "Employee Welfare",
    dei: "DEI",
    stk: "Stakeholder Outreach",
    eth: "Ethical Commitment",
    crisis: "Crisis Response",
    social: "Overall Social Exposure",
  };
  const MEASURE_KEYS = Object.keys(MEASURES);
  const STATS = ["mean", "median", "p10", "p25", "p75", "p90"];
  const SCALES = { level: "Level", index: "Index (base=100)", yoy: "Year-over-Year Change" };

  // Detect base path for GitHub Pages
  const BASE_PATH = (() => {
    const path = window.location.pathname;
    // If served from a subdirectory (GitHub Pages project site), find the base
    const htmlFile = path.match(/\/[^/]*\.html$/);
    return htmlFile ? path.slice(0, path.lastIndexOf('/')) : path.replace(/\/$/, '');
  })();

  // --- Data cache ---
  const _cache = new Map();

  async function loadJSON(relPath) {
    if (_cache.has(relPath)) return _cache.get(relPath);
    const resp = await fetch(BASE_PATH + "/data/" + relPath);
    if (!resp.ok) throw new Error(`Failed to load ${relPath}: ${resp.status}`);
    const data = await resp.json();
    _cache.set(relPath, data);
    return data;
  }

  // --- URL State ---
  function getParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      measure: p.get("measure") || "social",
      measures: p.get("measures") ? p.get("measures").split(",") : null,
      year_min: p.get("year_min") ? +p.get("year_min") : null,
      year_max: p.get("year_max") ? +p.get("year_max") : null,
      country: p.get("country") ? p.get("country").split(",") : [],
      industry: p.get("industry") ? p.get("industry").split(",") : [],
      firm: p.get("firm") ? p.get("firm").split(",") : [],
      stat: p.get("stat") || "mean",
      scale: p.get("scale") || "level",
      view: p.get("view") || "trend",
      entity_type: p.get("entity_type") || "country",
      ranking_mode: p.get("ranking_mode") || "single",
      ranking_year: p.get("ranking_year") ? +p.get("ranking_year") : null,
      period_start: p.get("period_start") ? +p.get("period_start") : null,
      period_end: p.get("period_end") ? +p.get("period_end") : null,
      top_n: p.get("top_n") ? +p.get("top_n") : 20,
      direction: p.get("direction") || "top",
      min_coverage: p.get("min_coverage") ? +p.get("min_coverage") : 0,
      search_entity: p.get("search_entity") || "",
    };
  }

  function setParams(obj) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        p.delete(k);
      } else if (Array.isArray(v)) {
        p.set(k, v.join(","));
      } else {
        p.set(k, String(v));
      }
    }
    const newUrl = window.location.pathname + (p.toString() ? "?" + p.toString() : "");
    window.history.replaceState(null, "", newUrl);
  }

  // --- Toast ---
  function toast(msg, duration = 3000) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), duration);
  }

  // --- Loading overlay ---
  function showLoading(container) {
    let ov = container.querySelector(".loading-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "loading-overlay";
      ov.innerHTML = '<div class="spinner"></div>';
      container.style.position = "relative";
      container.appendChild(ov);
    }
    ov.style.display = "flex";
    return ov;
  }
  function hideLoading(container) {
    const ov = container.querySelector(".loading-overlay");
    if (ov) ov.style.display = "none";
  }

  // --- Navbar ---
  function initNavbar() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".navbar nav a").forEach(a => {
      const href = a.getAttribute("href").split("?")[0];
      if (href === page || (page === "" && href === "index.html")) {
        a.classList.add("active");
      }
    });
    const hamburger = document.querySelector(".hamburger");
    const nav = document.querySelector(".navbar nav");
    if (hamburger && nav) {
      hamburger.addEventListener("click", () => nav.classList.toggle("open"));
    }
  }

  // --- Lookup data ---
  let _countries = null, _industries = null, _firms = null, _meta = null;

  async function getCountries() {
    if (!_countries) _countries = await loadJSON("countries.json");
    return _countries;
  }
  async function getIndustries() {
    if (!_industries) _industries = await loadJSON("industries.json");
    return _industries;
  }
  async function getFirms() {
    if (!_firms) _firms = await loadJSON("firms.json");
    return _firms;
  }
  async function getMeta() {
    if (!_meta) _meta = await loadJSON("meta.json");
    return _meta;
  }

  // --- Filter Panel Builder ---
  async function buildFilterPanel(container, options = {}) {
    const {
      showMeasure = true,
      multiMeasure = false,
      showYearRange = true,
      showCountry = true,
      showIndustry = true,
      showFirm = true,
      multiSelectEntities = false,
      onFilterChange = () => {},
    } = options;

    const meta = await getMeta();
    const params = getParams();
    let html = "";

    // Measure
    if (showMeasure) {
      if (multiMeasure) {
        html += `<div class="filter-group"><label>Measures</label><div id="filter-measures">`;
        for (const k of MEASURE_KEYS) {
          const checked = params.measures ? params.measures.includes(k) : k === params.measure;
          html += `<label style="display:block;font-size:0.85rem;font-weight:normal;text-transform:none;letter-spacing:0;margin-bottom:2px;cursor:pointer">
            <input type="checkbox" value="${k}" ${checked ? "checked" : ""}> ${MEASURES[k]}</label>`;
        }
        html += `</div></div>`;
      } else {
        html += `<div class="filter-group"><label>Measure</label>
          <select id="filter-measure">`;
        for (const k of MEASURE_KEYS) {
          html += `<option value="${k}" ${k === params.measure ? "selected" : ""}>${MEASURES[k]}</option>`;
        }
        html += `</select></div>`;
      }
    }

    // Year range
    if (showYearRange) {
      const ymin = params.year_min || meta.year_min;
      const ymax = params.year_max || meta.year_max;
      html += `<div class="filter-group"><label>Year Range</label>
        <div class="year-range">
          <input type="number" id="filter-ymin" value="${ymin}" min="${meta.year_min}" max="${meta.year_max}">
          <span>to</span>
          <input type="number" id="filter-ymax" value="${ymax}" min="${meta.year_min}" max="${meta.year_max}">
        </div></div>`;
    }

    // Country
    if (showCountry) {
      html += `<div class="filter-group"><label>Country</label>
        <div class="chip-input-wrap" id="country-wrap">
          <input type="text" id="filter-country-input" placeholder="Search countries...">
          <div class="dropdown-list" id="country-dropdown"></div>
        </div></div>`;
    }

    // Industry
    if (showIndustry) {
      html += `<div class="filter-group"><label>Industry (FF48)</label>
        <div class="chip-input-wrap" id="industry-wrap">
          <input type="text" id="filter-industry-input" placeholder="Search industries...">
          <div class="dropdown-list" id="industry-dropdown"></div>
        </div></div>`;
    }

    // Firm
    if (showFirm) {
      html += `<div class="filter-group"><label>Firm</label>
        <div class="chip-input-wrap" id="firm-wrap">
          <input type="text" id="filter-firm-input" placeholder="Search firms...">
          <div class="dropdown-list" id="firm-dropdown"></div>
        </div></div>`;
    }

    // Actions
    html += `<div class="filter-actions">
      <button class="btn btn-sm" id="filter-clear">Clear All</button>
      <button class="btn btn-sm" id="filter-copy-link">Copy Link</button>
    </div>`;

    container.innerHTML = html;

    // Wire events
    const fireChange = () => {
      const p = {};
      if (showMeasure && !multiMeasure) {
        p.measure = document.getElementById("filter-measure").value;
      }
      if (showMeasure && multiMeasure) {
        const checks = container.querySelectorAll("#filter-measures input:checked");
        const vals = Array.from(checks).map(c => c.value);
        p.measures = vals.length > 0 ? vals : ["social"];
      }
      if (showYearRange) {
        p.year_min = +document.getElementById("filter-ymin").value;
        p.year_max = +document.getElementById("filter-ymax").value;
      }
      setParams(p);
      onFilterChange(getParams());
    };

    // Simple select / number inputs
    container.querySelectorAll("select, input[type=number]").forEach(el => {
      el.addEventListener("change", fireChange);
    });
    // Checkboxes
    container.querySelectorAll("#filter-measures input[type=checkbox]").forEach(el => {
      el.addEventListener("change", fireChange);
    });

    // Chip inputs
    if (showCountry) {
      const countries = await getCountries();
      setupChipInput("country", countries.map(c => ({ id: c.code, label: `${c.name} (${c.code})` })),
        params.country, countries, fireChange, false, multiSelectEntities);
    }
    if (showIndustry) {
      const industries = await getIndustries();
      setupChipInput("industry", industries.map(i => ({ id: i.code, label: `${i.name} (${i.code})` })),
        params.industry, industries, fireChange, false, multiSelectEntities);
    }
    if (showFirm) {
      // Lazy load firms
      setupChipInput("firm", [], params.firm, [], fireChange, true, multiSelectEntities);
    }

    // Clear all
    document.getElementById("filter-clear").addEventListener("click", () => {
      window.location.search = "";
    });

    // Copy link
    document.getElementById("filter-copy-link").addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => toast("Link copied!"));
    });
  }

  function setupChipInput(name, items, initialIds, lookupList, onChange, lazyFirm = false, multiSelect = false) {
    const wrap = document.getElementById(`${name}-wrap`);
    const input = document.getElementById(`filter-${name}-input`);
    const dropdown = document.getElementById(`${name}-dropdown`);
    if (!wrap || !input || !dropdown) return;

    let selected = new Set(initialIds || []);
    let allItems = items;
    let firmsLoaded = false;

    function renderChips() {
      wrap.querySelectorAll(".chip").forEach(c => c.remove());
      const nameMap = {};
      for (const it of allItems) nameMap[it.id] = it.label;
      for (const id of selected) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${nameMap[id] || id} <button data-id="${id}">&times;</button>`;
        wrap.insertBefore(chip, input);
      }
      wrap.querySelectorAll(".chip button").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          selected.delete(btn.dataset.id);
          renderChips();
          updateURL();
          onChange();
        });
      });
    }

    function updateURL() {
      const obj = {};
      obj[name] = Array.from(selected);
      setParams(obj);
    }

    function showDropdown(filter) {
      const f = filter.toLowerCase();
      const matches = allItems.filter(it => !selected.has(it.id) && it.label.toLowerCase().includes(f)).slice(0, 50);
      dropdown.innerHTML = matches.map(m =>
        `<div class="option" data-id="${m.id}">${m.label}</div>`
      ).join("");
      dropdown.classList.toggle("open", matches.length > 0 && f.length > 0);
      dropdown.querySelectorAll(".option").forEach(opt => {
        opt.addEventListener("click", () => {
          if (!multiSelect) {
            // Single-select: clear previous selection
            selected.clear();
          }
          selected.add(opt.dataset.id);
          input.value = "";
          dropdown.classList.remove("open");
          renderChips();
          updateURL();
          onChange();
        });
      });
    }

    input.addEventListener("focus", async () => {
      if (lazyFirm && !firmsLoaded) {
        input.placeholder = "Loading firms...";
        const firms = await getFirms();
        allItems = firms.map(f => ({ id: f.id, label: `${f.name} (${f.id})` }));
        firmsLoaded = true;
        input.placeholder = "Search firms...";
        renderChips();
      }
      if (input.value) showDropdown(input.value);
    });
    input.addEventListener("input", () => showDropdown(input.value));
    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) dropdown.classList.remove("open");
    });

    renderChips();
  }

  // --- Data helpers ---
  function filterYears(data, yearMin, yearMax) {
    const result = {};
    for (const [year, val] of Object.entries(data)) {
      const y = +year;
      if (y >= yearMin && y <= yearMax) result[year] = val;
    }
    return result;
  }

  function applyScale(values, years, scale) {
    if (scale === "level") return values;
    if (scale === "index") {
      const base = values[0];
      if (!base || base === 0) return values;
      return values.map(v => v === null ? null : (v / base) * 100);
    }
    if (scale === "yoy") {
      return values.map((v, i) => {
        if (i === 0 || v === null || values[i - 1] === null) return null;
        return v - values[i - 1];
      });
    }
    return values;
  }

  // --- Helpers ---
  function navLink(page, params = {}) {
    const p = new URLSearchParams(params).toString();
    return page + (p ? "?" + p : "");
  }

  return {
    MEASURES, MEASURE_KEYS, STATS, SCALES,
    loadJSON, getParams, setParams,
    toast, showLoading, hideLoading,
    initNavbar, buildFilterPanel,
    getCountries, getIndustries, getFirms, getMeta,
    filterYears, applyScale, navLink, BASE_PATH,
  };
})();

document.addEventListener("DOMContentLoaded", () => App.initNavbar());
