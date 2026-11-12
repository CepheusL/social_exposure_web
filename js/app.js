/* ============ app.js — shared core: constants, site chrome, data access, UI helpers ============ */

const App = (() => {
/* ---------- Sections: each page declares <body data-section="social|climate|home"> ---------- */
const SECTION = (() => {
  const s = document.body && document.body.dataset.section;
  return s === "climate" ? "climate" : s === "home" ? "home" : "social";
})();
const IS_CLIMATE = SECTION === "climate";
const IS_HOME = SECTION === "home";
const ROOT = IS_CLIMATE ? "../" : "";   // climate pages live in climate/
const HOME_NAME = "Firm-level Sustainability Exposure";
const SECTIONS = [
  { key: "social", label: "Social Exposure", dir: "", landing: "overview.html" },
  { key: "climate", label: "Climate Change Exposure", dir: "climate/", landing: "index.html" },
];

  /* ---------- Site constants (single source of truth) ---------- */
  const SOCIAL_SITE = {
    name: "Unpacking Social Exposure",
    paperUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6770779",
    paperLabel: "Paper on SSRN",
    dataUrl: "data.html",
    shortCite: "Liu, Sautner, van Lent & Zhang (2026)",
    footerCite: "Liu, Sautner, van Lent &amp; Zhang (2026). <em>Unpacking Social Exposure</em>. SSRN Working Paper 6770779.",
    chartSource: 'Liu, Sautner, van Lent & Zhang (2026), "Unpacking Social Exposure," SSRN Working Paper 6770779',
    citation:
      "Liu, Mingyang and Sautner, Zacharias and van Lent, Laurence and Zhang, Ruishen, Unpacking Social Exposure " +
      "(May 15, 2026). TRR 266 Accounting for Transparency Working Paper Series No. 235, HKU Jockey Club Enterprise " +
      "Sustainability Global Research Institute Paper No. 2026/087, Available at SSRN: https://ssrn.com/abstract=6770779 " +
      "or http://dx.doi.org/10.2139/ssrn.6770779",
    bibtex:
`@techreport{liu2026unpacking,
  title       = {Unpacking Social Exposure},
  author      = {Liu, Mingyang and Sautner, Zacharias and van Lent, Laurence and Zhang, Ruishen},
  year        = {2026},
  month       = may,
  type        = {TRR 266 Accounting for Transparency Working Paper Series},
  number      = {235},
  institution = {SSRN},
  doi         = {10.2139/ssrn.6770779},
  url         = {https://ssrn.com/abstract=6770779}
}`,
  };

  const CLIMATE_SITE = {
    name: "Firm-Level Climate Change Exposure",
    paperUrl: "https://doi.org/10.1111/jofi.13219",
    paperLabel: "Paper in the Journal of Finance",
    dataUrl: "data.html",
    shortCite: "Sautner, van Lent, Vilkov & Zhang (2023)",
    footerCite: "Sautner, van Lent, Vilkov &amp; Zhang (2023). <em>Firm-Level Climate Change Exposure</em>. Journal of Finance 78(3), 1449–1498.",
    chartSource: 'Sautner, van Lent, Vilkov & Zhang (2023), "Firm-Level Climate Change Exposure," Journal of Finance 78(3)',
    citation:
      'Sautner, Zacharias, Laurence van Lent, Grigory Vilkov, and Ruishen Zhang. "Firm-Level Climate Change Exposure." ' +
      "The Journal of Finance 78, no. 3 (2023): 1449–1498. https://doi.org/10.1111/jofi.13219",
    dataCitation:
      'Sautner, Zacharias, Laurence van Lent, Grigory Vilkov, and Ruishen Zhang. "Data for ‘Firm-Level Climate Change Exposure’." ' +
      "https://cepheusl.github.io/social_exposure_web/climate/data.html",
    bibtex:
`@article{sautner2023firm,
  title   = {Firm-Level Climate Change Exposure},
  author  = {Sautner, Zacharias and van Lent, Laurence and Vilkov, Grigory and Zhang, Ruishen},
  journal = {The Journal of Finance},
  volume  = {78},
  number  = {3},
  pages   = {1449--1498},
  year    = {2023},
  doi     = {10.1111/jofi.13219}
}`,
  };
  const SITE = IS_CLIMATE ? CLIMATE_SITE : SOCIAL_SITE;

const NAV = [
  [IS_CLIMATE ? "index.html" : "overview.html", "Overview"], ["explore.html", "Explore"], ["compare.html", "Compare"],
    ["firm.html", "Firms"], ["ranking.html", "Ranking"], ["patterns.html", "Patterns"], ["methods.html", "Methods"], ["data.html", "Data"],
  ];

  /* Social measures: order matters (adjacent colours are validated for colour-vision deficiency in this order) */
  const SOCIAL_MEASURES = {
    emp: "Employee Welfare", dei: "DEI", stk: "Stakeholder Outreach",
    eth: "Ethical Commitment", crisis: "Crisis Response", social: "Overall Social Exposure",
  };
  const SOCIAL_COLORS = {
    emp: "#2a78d6", dei: "#eb6834", stk: "#1baf7a", eth: "#eda100", crisis: "#e87ba4", social: "#141413",
  };

  /* Climate: four topics (overall plus three topics) x five metrics. Data keys are `${topic}_${metric}`. */
  const TOPICS = { cc: "Climate change", op: "Opportunity", rg: "Regulatory", ph: "Physical" };
  const TOPIC_KEYS = ["cc", "op", "rg", "ph"];
  const TOPIC_COLORS = { cc: "#141413", op: "#1baf7a", rg: "#2a78d6", ph: "#eb6834" };
  const METRICS = { expo: "Exposure", risk: "Risk", pos: "Positive sentiment", neg: "Negative sentiment", sent: "Net sentiment" };
  const METRIC_KEYS = ["expo", "risk", "pos", "neg", "sent"];
  const METRIC_COLORS = { expo: "#141413", risk: "#e87ba4", pos: "#eda100", neg: "#6250d6", sent: "#141413" };
  const CLIMATE_KEYS = TOPIC_KEYS.flatMap((t) => METRIC_KEYS.map((m) => `${t}_${m}`));
  /** Plain-word label of one climate measure, e.g. "Opportunity exposure" or "Climate change risk". */
  const measureLabel = (t, m) => `${TOPICS[t]} ${METRICS[m].toLowerCase()}`;

  const MEASURES = IS_CLIMATE ? TOPICS : SOCIAL_MEASURES;
  const MEASURE_KEYS = IS_CLIMATE ? TOPIC_KEYS : ["emp", "dei", "stk", "eth", "crisis", "social"];
  const DOMAIN_KEYS = IS_CLIMATE ? ["op", "rg", "ph"] : ["emp", "dei", "stk", "eth", "crisis"];
  const MEASURE_COLORS = IS_CLIMATE ? TOPIC_COLORS : SOCIAL_COLORS;

  const STATS = IS_CLIMATE ? {
    mean:     { label: "Mean" },
    median:   { label: "Median" },
    p75:      { label: "75th percentile" },
    p90:      { label: "90th percentile" },
    share:    { label: "Share of firms discussing", pct: true },
    mean_pos: { label: "Mean among firms discussing" },
  } : {
    mean:     { label: "Mean",                        axis: "Mean exposure" },
    median:   { label: "Median",                      axis: "Median exposure" },
    p75:      { label: "75th percentile",             axis: "75th percentile of exposure" },
    p90:      { label: "90th percentile",             axis: "90th percentile of exposure" },
    share:    { label: "Share of firms discussing",   axis: "% of firms discussing", pct: true },
    mean_pos: { label: "Mean among firms discussing", axis: "Mean exposure among firms discussing" },
  };
  const STAT_KEYS = Object.keys(STATS);
  const STAT_INDEX = { mean: 0, median: 1, p75: 2, p90: 3, share: 4, mean_pos: 5 };  // climate aggregate arrays
  const UNIT = IS_CLIMATE ? "per 1,000 bigrams" : "sentences per 1,000";

  /* ---------- Small utilities ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("en-US"));
  const periodYear = (p) => +String(p).slice(0, 4);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** Format a statistic value for display. Shares are stored as fractions (0–1). */
  function fmt(v, stat = "mean", digits) {
    if (v == null || isNaN(v)) return "–";
    if (STATS[stat] && STATS[stat].pct) return (v * 100).toFixed(digits ?? 0) + "%";
    return Number(v).toFixed(digits ?? 2);
  }
  /** Number with enough decimals for small climate values (0.014 stays readable). */
  function dec(v) {
    if (v == null || isNaN(v)) return "–";
    const a = Math.abs(v);
    return Number(v).toFixed(a !== 0 && a < 0.1 ? 3 : 2);
  }

  /* Base path for GitHub Pages project sites */
  const BASE_PATH = (() => {
    const path = window.location.pathname;
    return /\/[^/]*\.html$/.test(path) ? path.slice(0, path.lastIndexOf("/")) : path.replace(/\/$/, "");
  })();

  /* Data requests carry the build date as a version so browsers never mix old and new data files;
     meta.json itself is always revalidated. */
  const _cache = new Map();
  function _fetchJSON(url, init) {
    return fetch(url, init).then((resp) => {
      if (!resp.ok) throw new Error(`Failed to load ${url.split("/data/")[1] || url} (${resp.status})`);
      return resp.json();
    });
  }
  function loadJSON(relPath) {
    if (!_cache.has(relPath)) {
      const p = relPath === "meta.json"
        ? _fetchJSON(BASE_PATH + "/data/meta.json", { cache: "no-cache" })
        : loadJSON("meta.json").then((m) => _fetchJSON(`${BASE_PATH}/data/${relPath}?v=${encodeURIComponent(m.build_id || m.build_date)}`));
      p.catch(() => _cache.delete(relPath));
      _cache.set(relPath, p);
    }
    return _cache.get(relPath);
  }

  /* ---------- URL state ---------- */
  function q() { return new URLSearchParams(window.location.search); }
  function param(key, fallback = null) { const v = q().get(key); return v === null || v === "" ? fallback : v; }
  function paramInt(key, fallback = null) { const v = param(key); return v === null || isNaN(+v) ? fallback : +v; }
  function paramList(key) { const v = param(key); return v ? v.split(",").filter(Boolean) : []; }
  function setParams(obj) {
    const p = q();
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) p.delete(k);
      else p.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const s = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (s ? "?" + s : ""));
  }
  function link(page, params = {}) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") p.set(k, Array.isArray(v) ? v.join(",") : v);
    const s = p.toString();
    return page + (s ? "?" + s : "");
  }

  /* ---------- Clipboard, toast, dialogs ---------- */
  async function copy(text, msg = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    toast(msg);
  }

  function toast(msg, duration = 2600) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), duration);
  }

  function openCite() {
    let dlg = document.getElementById("cite-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "cite-dialog"; dlg.className = "dialog";
      dlg.setAttribute("aria-labelledby", "cite-dialog-title");
      dlg.innerHTML = `
        <div class="dialog-head">
          <h2 id="cite-dialog-title">Cite this work</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">&times;</button>
        </div>
        <p class="dialog-label">${SITE.dataCitation ? "Paper" : "Citation"}</p>
        <p class="cite-text">${esc(SITE.citation)}</p>
        <div class="dialog-actions">
          <button type="button" class="btn btn-sm" data-copy="cite">Copy citation</button>
          <a class="btn btn-sm" href="${SITE.paperUrl}" target="_blank" rel="noopener">Open ${esc(SITE.paperLabel.replace(/^Paper/, "paper"))}</a>
        </div>
        ${SITE.dataCitation ? `<p class="dialog-label">Dataset</p>
        <p class="cite-text">${esc(SITE.dataCitation)}</p>
        <div class="dialog-actions"><button type="button" class="btn btn-sm" data-copy="data">Copy dataset citation</button></div>` : ""}
        <p class="dialog-label">BibTeX</p>
        <pre class="cite-bib">${esc(SITE.bibtex)}</pre>
        <div class="dialog-actions"><button type="button" class="btn btn-sm" data-copy="bib">Copy BibTeX</button></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
      dlg.querySelector('[data-copy="cite"]').addEventListener("click", () => copy(SITE.citation, "Citation copied"));
      const dataBtn = dlg.querySelector('[data-copy="data"]');
      if (dataBtn) dataBtn.addEventListener("click", () => copy(SITE.dataCitation, "Dataset citation copied"));
      dlg.querySelector('[data-copy="bib"]').addEventListener("click", () => copy(SITE.bibtex, "BibTeX copied"));
    }
    dlg.showModal();
  }

  /* ---------- Site chrome (header + footer injected on every page) ---------- */
  function renderChrome() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    const current = SECTIONS.find((s) => s.key === SECTION) || { key: "home", label: HOME_NAME, dir: "", landing: "index.html" };
    const sectionLinks = SECTIONS.map((s) => `<a href="${ROOT}${s.dir}${s.landing}"${s.key === SECTION
      ? ' class="active" aria-current="true"' : ""}>${s.label}</a>`).join("");
    const brandHref = IS_HOME ? "index.html" : `${ROOT}${current.landing}`;
    const header = document.getElementById("site-header");
    if (header) {
      header.outerHTML = `
        <header class="navbar">
          <div class="nav-top">
            <a class="brand" href="${brandHref}" aria-label="${esc(current.label)} overview"><span class="brand-text">${esc(current.label)}</span></a>
            <nav class="section-nav" aria-label="Datasets">${sectionLinks}</nav>
            <button class="hamburger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
              <span></span><span></span><span></span>
            </button>
          </div>
          <div class="nav-sub${IS_HOME ? " nav-sub-home" : ""}" id="site-nav">
            <nav class="section-nav section-nav-mobile" aria-label="Datasets (menu)">${sectionLinks}</nav>
            ${IS_HOME ? "" : `
            <nav class="page-nav" aria-label="${esc(current.label)} pages">
              ${NAV.map(([href, label]) =>
                `<a href="${href}"${href === page ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}
            </nav>`}
          </div>
        </header>`;
    }
    const footer = document.getElementById("site-footer");
    if (footer) {
      footer.outerHTML = IS_HOME ? `
        <footer class="site-footer">
          <div class="footer-inner">
            <p class="footer-cite">Data explorers for firm-level sustainability exposure research. Built from earnings conference calls.</p>
            <nav class="footer-links" aria-label="Footer">
              <a href="overview.html">Social Exposure data</a>
              <a href="climate/index.html">Climate Change Exposure data</a>
            </nav>
          </div>
        </footer>` : `
        <footer class="site-footer">
          <div class="footer-inner">
            <p class="footer-cite">${SITE.footerCite}</p>
            <nav class="footer-links" aria-label="Footer">
              <a href="${SITE.paperUrl}" target="_blank" rel="noopener">Paper</a>
              <a href="${SITE.dataUrl}">Data</a>
              <button type="button" class="footer-cite-btn" data-open-cite>Cite</button>
            </nav>
          </div>
        </footer>`;
    }
    document.querySelectorAll("[data-open-cite]").forEach((b) => b.addEventListener("click", openCite));

    const burger = document.querySelector(".hamburger");
    const nav = document.getElementById("site-nav");
    if (burger && nav) {
      burger.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        burger.setAttribute("aria-expanded", String(open));
      });
    }
  }

  /** Mobile drawer for a sidebar or a controls panel. */
  function initDrawer(toggleId, panelId) {
    const btn = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    let overlay = document.getElementById("drawer-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "drawer-overlay"; overlay.className = "drawer-overlay";
      document.body.appendChild(overlay);
    }
    const set = (open) => {
      panel.classList.toggle("open", open);
      overlay.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.setAttribute("aria-controls", panelId);
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", () => set(!panel.classList.contains("open")));
    overlay.addEventListener("click", () => set(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  }

  /* ---------- Data access ---------- */
  let _meta, _countries, _industries, _firms, _firmMap, _cMap, _iMap;
  async function getMeta() { if (!_meta) _meta = await loadJSON("meta.json"); return _meta; }
  async function getCountries() {
    if (!_countries) { _countries = await loadJSON("countries.json"); _cMap = new Map(_countries.map((c) => [c.code, c])); }
    return _countries;
  }
  async function getIndustries() {
    if (!_industries) { _industries = await loadJSON("industries.json"); _iMap = new Map(_industries.map((i) => [i.code, i])); }
    return _industries;
  }
  async function getFirms() {
    if (!_firms) {
      const d = await loadJSON("firms.json");
      _firms = d.rows.map((r) => ({ id: r[0], name: r[1], country: r[2], industry: r[3], first: r[4], last: r[5], gvkey: r[6] || null }));
      _firmMap = new Map(_firms.map((f) => [f.id, f]));
    }
    return _firms;
  }
  async function getFirm(id) { await getFirms(); return _firmMap.get(String(id)) || null; }
  async function lookups() { await Promise.all([getCountries(), getIndustries()]); }
  const countryName = (code) => (_cMap && _cMap.get(code) ? _cMap.get(code).name : code || "–");
  const industryName = (code) => (_iMap && _iMap.get(code) ? _iMap.get(code).name : code || "–");
  const industryShort = (code) => (_iMap && _iMap.get(code) ? _iMap.get(code).short : code || "–");

  /** Aggregates: kind = global | country | industry; freq = annual | quarterly. */
  function loadAgg(kind, id, freq = "annual") {
    const dir = freq === "quarterly" ? "agg_q" : "agg";
    return loadJSON(kind === "global" ? `${dir}/global.json` : `${dir}/${kind}/${id}.json`);
  }
  async function loadFirm(id, freq = "annual") {
    const idx = await loadJSON("firm/index.json");
    const c = idx[id];
    if (c === undefined) return null;
    const chunk = await loadJSON(`${freq === "quarterly" ? "firm_q" : "firm"}/chunk_${c}.json`);
    return chunk[id] || null;
  }
  /** Firm record -> {period: {measure: value}} so firms and aggregates share one shape.
      Climate records omit net sentiment; it equals positive minus negative sentiment. */
  function firmToPeriods(rec, freq = "annual") {
    const out = {};
    if (!rec) return out;
    const keys = freq === "quarterly" ? rec.q : rec.years;
    const mk = IS_CLIMATE ? CLIMATE_KEYS : MEASURE_KEYS;
    keys.forEach((p, i) => {
      const row = {};
      for (const m of mk) row[m] = rec[m] ? rec[m][i] : null;
      if (IS_CLIMATE) for (const t of TOPIC_KEYS) {
        const pos = row[`${t}_pos`], neg = row[`${t}_neg`];
        row[`${t}_sent`] = pos == null || neg == null ? null : Math.round((pos - neg) * 1000) / 1000;
      }
      out[String(p)] = row;
    });
    return out;
  }
  /** Climate aggregate cell: row = agg[period]; returns the statistic for one measure key. */
  function aggVal(row, key, stat = "mean") {
    if (!row || !row[key]) return null;
    const v = row[key][STAT_INDEX[stat]];
    return v === undefined ? null : v;
  }

  /* ---------- UI helpers ---------- */

  /** Accessible combobox. getItems(query) -> [{id, label, sub}] (sync or async). */
  function combobox({ input, list, getItems, onSelect, minChars = 1 }) {
    const listId = list.id || "cb-" + Math.random().toString(36).slice(2);
    list.id = listId;
    list.setAttribute("role", "listbox");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("autocomplete", "off");
    let items = [], active = -1, token = 0;

    const close = () => {
      list.classList.remove("open"); input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant"); active = -1;
    };
    const highlight = (i) => {
      const opts = list.querySelectorAll(".option");
      opts.forEach((o) => o.classList.remove("active"));
      active = i;
      if (opts[i]) {
        opts[i].classList.add("active");
        input.setAttribute("aria-activedescendant", opts[i].id);
        opts[i].scrollIntoView({ block: "nearest" });
      }
    };
    const choose = (i) => { const it = items[i]; if (!it) return; close(); onSelect(it); };

    async function refresh() {
      const query = input.value.trim();
      if (query.length < minChars) { close(); return; }
      const my = ++token;
      const res = await getItems(query);
      if (my !== token) return;
      items = res || [];
      list.innerHTML = items.length
        ? items.map((it, i) => `<div class="option" role="option" id="${listId}-o${i}" data-i="${i}">
            <span class="option-label">${esc(it.label)}</span>${it.sub ? `<span class="option-sub">${esc(it.sub)}</span>` : ""}</div>`).join("")
        : `<div class="option-empty">No matches</div>`;
      list.classList.add("open");
      input.setAttribute("aria-expanded", "true");
      active = -1;
    }

    input.addEventListener("input", refresh);
    input.addEventListener("focus", () => { if (input.value.trim().length >= minChars) refresh(); });
    input.addEventListener("keydown", (e) => {
      const n = items.length;
      if (e.key === "ArrowDown") { e.preventDefault(); if (!list.classList.contains("open")) refresh(); else highlight((active + 1) % Math.max(n, 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight((active - 1 + n) % Math.max(n, 1)); }
      else if (e.key === "Enter") { if (list.classList.contains("open") && n) { e.preventDefault(); choose(active >= 0 ? active : 0); } }
      else if (e.key === "Escape") { close(); }
    });
    list.addEventListener("mousedown", (e) => {
      const opt = e.target.closest(".option");
      if (opt) { e.preventDefault(); choose(+opt.dataset.i); }
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
    return { close, refresh };
  }

  /** Search helpers that feed combobox(). */
  function matchScore(label, q) {
    const l = label.toLowerCase();
    if (l.startsWith(q)) return 0;
    if (l.includes(" " + q)) return 1;
    return l.includes(q) ? 2 : -1;
  }
  async function searchFirms(query, limit = 30) {
    const firms = await getFirms();
    await lookups();
    const ql = query.toLowerCase();
    const isId = /^\d+$/.test(ql);
    const isIsin = IS_CLIMATE && /^[a-z]{2}[a-z0-9]*\d[a-z0-9]*$/.test(ql) && ql.length >= 4;
    const hits = [];
    for (const f of firms) {
      let s;
      if (isId) s = (IS_CLIMATE ? (f.gvkey || "") : f.id).startsWith(ql) ? 0 : -1;
      else if (isIsin && f.id.toLowerCase().startsWith(ql)) s = 0;
      else s = matchScore(f.name, ql);
      if (s >= 0) hits.push([s, f]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
    return hits.slice(0, limit).map(([, f]) => ({
      id: f.id, label: f.name,
      sub: [countryName(f.country), industryShort(f.industry), `${f.first}–${f.last}`, IS_CLIMATE ? f.id : null]
        .filter(Boolean).join(" · "),
    }));
  }
  async function searchCountries(query) {
    const cs = await getCountries();
    const ql = query.toLowerCase();
    return cs.map((c) => [matchScore(`${c.name} (${c.code})`, ql), c]).filter((x) => x[0] >= 0)
      .sort((a, b) => a[0] - b[0] || b[1].n_firms - a[1].n_firms)
      .slice(0, 40).map(([, c]) => ({ id: c.code, label: c.name, sub: `${num(c.n_firms)} firms` }));
  }
  async function searchIndustries(query) {
    const is = await getIndustries();
    const ql = query.toLowerCase();
    return is.map((i) => [matchScore(i.name, ql), i]).filter((x) => x[0] >= 0)
      .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
      .slice(0, 48).map(([, i]) => ({ id: i.code, label: i.name, sub: `${num(i.n_firms)} firms` }));
  }

  /** Two linked year inputs; clamps to range and swaps if reversed. */
  function yearRange(container, { min, max, from, to, onChange, idPrefix = "yr" }) {
    container.innerHTML = `
      <div class="year-range">
        <label class="sr-only" for="${idPrefix}-from">From year</label>
        <input type="number" id="${idPrefix}-from" min="${min}" max="${max}" value="${from}" inputmode="numeric">
        <span aria-hidden="true">to</span>
        <label class="sr-only" for="${idPrefix}-to">To year</label>
        <input type="number" id="${idPrefix}-to" min="${min}" max="${max}" value="${to}" inputmode="numeric">
      </div>`;
    const a = container.querySelector(`#${idPrefix}-from`);
    const b = container.querySelector(`#${idPrefix}-to`);
    const sync = () => {
      let x = clamp(parseInt(a.value, 10) || min, min, max);
      let y = clamp(parseInt(b.value, 10) || max, min, max);
      if (x > y) [x, y] = [y, x];
      a.value = x; b.value = y;
      onChange(x, y);
    };
    a.addEventListener("change", sync);
    b.addEventListener("change", sync);
    return { get: () => [+a.value, +b.value], set: (x, y) => { a.value = x; b.value = y; } };
  }

  /** Segmented control (radio group). options: [[value, label]] */
  function segmented(container, { name, options, value, onChange, label }) {
    container.innerHTML = `<div class="segmented" role="radiogroup" aria-label="${esc(label || name)}">
      ${options.map(([v, l]) => `<label class="seg"><input type="radio" name="${name}" value="${esc(v)}" ${v === value ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}
    </div>`;
    container.querySelectorAll("input").forEach((r) => r.addEventListener("change", () => onChange(r.value)));
    return {
      set(v) { const r = container.querySelector(`input[value="${CSS.escape(v)}"]`); if (r) r.checked = true; },
      setDisabled(v, dis) { const r = container.querySelector(`input[value="${CSS.escape(v)}"]`); if (r) { r.disabled = dis; r.closest(".seg").classList.toggle("disabled", dis); } },
    };
  }

  /** Loading state: hold the previous render, dim it, show a spinner after a short delay. */
  function busy(el, on) {
    if (!el) return;
    if (on) {
      el.classList.add("is-loading");
      el._busyT = setTimeout(() => el.classList.add("show-spinner"), 250);
    } else {
      clearTimeout(el._busyT);
      el.classList.remove("is-loading", "show-spinner");
    }
  }

  /** Inline notice inside a container (replaces the previous one). */
  function notice(container, html, kind = "info") {
    if (!container) return;
    container.innerHTML = html ? `<div class="notice notice-${kind}" role="status">${html}</div>` : "";
  }

  /** Featured-company card (sparkline vs all firms); p from featured.json. */
  function firmCard(p, { ref, yMax }) {
    const color = MEASURE_COLORS[p.dominant] || MEASURE_COLORS.social;
    return `<a class="firm-card" href="${link("firm.html", { id: p.id })}"
               aria-label="${esc(p.name)}, ${esc(countryName(p.country))}: peak in ${p.peak_year}, mostly ${esc(MEASURES[p.dominant] || "")}">
      <div class="firm-card-head">
        <span class="firm-card-name">${esc(p.name)}</span>
        <span class="firm-card-ctry" title="${esc(countryName(p.country))}">${esc(p.country || "")}</span>
      </div>
      ${Charts.spark(p.spark || p.social_3y, { color, ref, yMax, h: 58, fill: true })}
      <div class="firm-card-foot">
        <span class="tag"><span class="measure-dot" style="background:${color}"></span><span>${esc(MEASURES[p.dominant] || "–")}</span></span>
        <span>Peak ${p.peak_year}</span>
      </div>
    </a>`;
  }

  /** Recently viewed firms (per-viewer convenience; storage may be unavailable). */
  const RECENT_KEY = IS_CLIMATE ? "cce_recent_firms" : "use_recent_firms";
  function recentFirms() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x) => typeof x === "string"); } catch { return []; }
  }
  function rememberFirm(id) {
    try {
      const list = [String(id), ...recentFirms().filter((x) => x !== String(id))].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch { /* storage unavailable */ }
  }

  renderChrome();

  return {
    SECTION, IS_CLIMATE, ROOT,
    SITE, MEASURES, MEASURE_KEYS, DOMAIN_KEYS, MEASURE_COLORS, STATS, STAT_KEYS, UNIT, BASE_PATH,
    TOPICS, TOPIC_KEYS, TOPIC_COLORS, METRICS, METRIC_KEYS, METRIC_COLORS, CLIMATE_KEYS, measureLabel,
    esc, num, fmt, dec, clamp, periodYear,
    loadJSON, param, paramInt, paramList, setParams, link,
    copy, toast, openCite, initDrawer, busy, notice,
    getMeta, getCountries, getIndustries, getFirms, getFirm, lookups, countryName, industryName, industryShort,
    loadAgg, loadFirm, firmToPeriods, aggVal,
    combobox, searchFirms, searchCountries, searchIndustries, yearRange, segmented,
    firmCard, recentFirms, rememberFirm,
  };
})();
