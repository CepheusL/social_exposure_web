/* ============ charts.js — Chart.js wrappers, plugins, sparklines, colour scales ============ */

const Charts = (() => {
  const INK = "#141413";
  const INK_2 = "#4a4843";
  const MUTED = "#6f6d66";
  const GRID = "#eeece5";
  const AXIS = "#d6d4cc";
  const FONT = "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif";

  /* Sequential single-hue ramp (light -> dark blue) for heatmaps and maps */
  const SEQ = ["#e8f1fc", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

  if (window.Chart) {
    Chart.defaults.font.family = FONT;
    Chart.defaults.color = MUTED;
  }

  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };

  /** Sequential colour for t in [0,1]. */
  function seq(t) {
    if (t == null || isNaN(t)) return "#f0efea";
    t = Math.min(1, Math.max(0, t));
    const x = t * (SEQ.length - 1), i = Math.min(SEQ.length - 2, Math.floor(x)), f = x - i;
    const a = hexToRgb(SEQ[i]), b = hexToRgb(SEQ[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
  }
  /** Text colour that reads on a sequential cell. */
  const seqInk = (t) => (t != null && t > 0.55 ? "#ffffff" : INK);

  /* ---------- Plugins ---------- */

  // White background so PNG exports are not transparent
  const whiteBg = {
    id: "whiteBg",
    beforeDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.restore();
    },
  };

  // Vertical guide line at the hovered period
  const crosshair = {
    id: "crosshair",
    afterDatasetsDraw(chart) {
      const act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act.length || chart.config.type !== "line") return;
      const x = act[0].element.x, a = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = "rgba(20,20,19,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore();
    },
  };

  // Direct labels at the end of each line, de-collided; hidden on narrow charts (the legend remains)
  const endLabels = {
    id: "endLabels",
    beforeLayout(chart, _args, opts) {
      if (!opts || !opts.enabled) return;
      const pad = chart.options.layout.padding;
      const wide = chart.width >= 560;
      chart._endLabelsOn = wide;
      const w = wide ? Math.min(opts.maxWidth || 190, opts.width || 0) + 22 : 10;
      if (typeof pad === "object") pad.right = w; else chart.options.layout.padding = { top: 6, right: w, bottom: 0, left: 0 };
    },
    beforeUpdate(chart, _args, opts) {
      if (opts && !opts.enabled && typeof chart.options.layout.padding === "object") chart.options.layout.padding.right = 10;
    },
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.enabled || !chart._endLabelsOn) return;
      const ctx = chart.ctx, area = chart.chartArea;
      const items = [];
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden || !chart.isDatasetVisible(i)) return;
        let j = ds.data.length - 1;
        while (j >= 0 && (ds.data[j] == null || isNaN(ds.data[j]))) j--;
        if (j < 0 || !meta.data[j]) return;
        items.push({ y: meta.data[j].y, x: meta.data[j].x, label: ds.label, color: ds.borderColor });
      });
      items.sort((a, b) => a.y - b.y);
      const gap = 14;
      for (let k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < gap) items[k].y = items[k - 1].y + gap;
      const overflow = items.length ? items[items.length - 1].y - area.bottom : 0;
      if (overflow > 0) items.forEach((it) => (it.y -= overflow));
      ctx.save();
      ctx.font = `600 11px ${FONT}`;
      ctx.textBaseline = "middle";
      for (const it of items) {
        const x0 = area.right + 8;
        ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x0 + 3, it.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = INK_2;
        let text = it.label;
        const max = (opts.maxWidth || 190) - 4;
        while (ctx.measureText(text).width > max && text.length > 4) text = text.slice(0, -2);
        if (text !== it.label) text = text.trimEnd() + "…";
        ctx.fillText(text, x0 + 11, it.y);
      }
      ctx.restore();
    },
  };

  // Percentage labels inside stacked bar segments when they fit
  const segmentLabels = {
    id: "segmentLabels",
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts || !opts.enabled) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (!chart.isDatasetVisible(i)) return;
        meta.data.forEach((bar, j) => {
          const v = ds.data[j];
          if (v == null) return;
          const w = Math.abs(bar.x - bar.base);
          const text = Math.round(v) + "%";
          if (w < ctx.measureText(text).width + 10) return;
          ctx.fillStyle = ds.labelInk || INK;
          ctx.fillText(text, (bar.x + bar.base) / 2, bar.y);
        });
      });
      ctx.restore();
    },
  };

  if (window.Chart) Chart.register(whiteBg, crosshair, endLabels, segmentLabels);

  /* ---------- Card chrome: toolbar, table view, captions ---------- */

  function _card(canvas) { return canvas.closest(".chart-card"); }

  function _toolbar(card, chart, opts) {
    const tools = card && card.querySelector(".chart-tools");
    if (!tools) return;
    tools.innerHTML = `
      <button type="button" class="chart-btn" data-act="png" title="Download chart as PNG">PNG</button>
      ${opts.csv ? '<button type="button" class="chart-btn" data-act="csv" title="Download chart data as CSV">CSV</button>' : ""}
      <button type="button" class="chart-btn" data-act="cite" title="Copy a citation for this chart">Cite</button>
      <button type="button" class="chart-btn" data-act="link" title="Copy a link to this view">Link</button>`;
    tools.querySelector('[data-act="png"]').onclick = () => {
      const a = document.createElement("a");
      a.href = chart.toBase64Image("image/png", 1);
      a.download = (opts.filename || "chart") + ".png";
      a.click();
      App.toast("Image downloaded");
    };
    if (opts.csv) tools.querySelector('[data-act="csv"]').onclick = opts.csv;
    tools.querySelector('[data-act="cite"]').onclick = async () => {
      const meta = await App.getMeta();
      const title = (card.querySelector(".chart-title") || {}).textContent || document.title;
      const text = `${title}. Source: ${App.SITE.shortCite}, "Unpacking Social Exposure," SSRN Working Paper 6770779; ` +
        `data: ${meta.data_version}. ${window.location.href}`;
      App.copy(text, "Chart citation copied");
    };
    tools.querySelector('[data-act="link"]').onclick = () => App.copy(window.location.href, "Link copied");
  }

  function _table(card, labels, datasets, formatter, firstHeader) {
    if (!card) return;
    const box = card.querySelector(".chart-table");
    const btn = card.querySelector(".table-toggle");
    if (!box || !btn) return;
    const render = () => {
      box.innerHTML = `<div class="table-scroll"><table>
        <thead><tr><th scope="col">${App.esc(firstHeader || "Period")}</th>${datasets.map((d) => `<th scope="col">${App.esc(d.label)}</th>`).join("")}</tr></thead>
        <tbody>${labels.map((l, i) => `<tr><th scope="row">${App.esc(l)}</th>${datasets.map((d) => `<td>${formatter(d.data[i], d)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
    };
    if (!box.hidden) render();
    btn.onclick = () => {
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? "View as table" : "Hide table";
      btn.setAttribute("aria-expanded", String(!box.hidden));
      if (!box.hidden) render();
    };
    btn.setAttribute("aria-expanded", String(!box.hidden));
  }

  function _csv(labels, datasets, filename, header) {
    return () => {
      const head = [header || "Period", ...datasets.map((d) => `"${String(d.label).replace(/"/g, '""')}"`)];
      const rows = labels.map((l, i) => [l, ...datasets.map((d) => (d.data[i] ?? ""))]);
      const blob = new Blob([[head, ...rows].map((r) => r.join(",")).join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (filename || "data") + ".csv"; a.click();
      URL.revokeObjectURL(url);
      App.toast("CSV downloaded");
    };
  }

  function _textWidth(texts) {
    const c = document.createElement("canvas").getContext("2d");
    c.font = `600 11px ${FONT}`;
    return Math.max(0, ...texts.map((t) => c.measureText(t).width));
  }

  const _tooltip = {
    backgroundColor: "rgba(20,20,19,0.94)",
    titleFont: { family: FONT, size: 12, weight: 600 },
    bodyFont: { family: FONT, size: 11.5 },
    footerFont: { family: FONT, size: 11, weight: 400 },
    footerColor: "#c3c2b7",
    padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
  };

  /**
   * Line chart. datasets: [{label, data, color, width, dash, meta}]
   * opts: {yLabel, percent, zeroBase, endLabels, filename, title, valueFmt, legend, yMax}
   */
  function line(canvasId, { labels, datasets }, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const card = _card(canvas);
    const valueFmt = opts.valueFmt || ((v) => (v == null ? "–" : opts.percent ? v.toFixed(1) + "%" : v.toFixed(2)));
    const showLegend = opts.legend !== undefined ? opts.legend : datasets.length > 1;

    const mapped = datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.color,
      borderWidth: ds.width || 2,
      borderDash: ds.dash || [],
      pointRadius: 0,
      pointHoverRadius: 4.5,
      pointHitRadius: 12,
      pointBackgroundColor: ds.color,
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      tension: 0.3,
      cubicInterpolationMode: "monotone",
      spanGaps: true,
      fill: ds.fill ? { target: "origin", above: rgba(ds.color, 0.08) } : false,
      order: ds.order ?? 0,
      _meta: ds.meta || null,
    }));

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 10, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          display: showLegend,
          position: "top", align: "start",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 14,
                    font: { family: FONT, size: 11.5, weight: 500 }, color: INK_2 },
        },
        tooltip: {
          ..._tooltip,
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${valueFmt(c.parsed.y)}`,
            footer: (items) => {
              const m = items[0] && items[0].dataset._meta;
              const e = m && m[items[0].dataIndex];
              return e && e.nfirm !== undefined ? `${App.num(e.nfirm)} firms` : "";
            },
          },
        },
        endLabels: { enabled: opts.endLabels !== undefined ? opts.endLabels : datasets.length > 1,
                     width: _textWidth(datasets.map((d) => d.label)), maxWidth: 190 },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: AXIS },
          ticks: { color: MUTED, font: { size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 14 },
        },
        y: {
          beginAtZero: opts.zeroBase !== false,
          grace: opts.yMax != null ? 0 : "6%",
          ...(opts.yMax != null ? { max: opts.yMax } : {}),
          grid: { color: GRID },
          border: { display: false },
          title: { display: !!opts.yLabel, text: opts.yLabel || "", color: MUTED, font: { size: 11, weight: 500 } },
          ticks: { color: MUTED, font: { size: 11 }, padding: 6,
                   callback: (v) => (opts.percent ? v + "%" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })) },
        },
      },
    };

    let chart = canvas._chart;
    if (chart && chart.config.type !== "line") { chart.destroy(); chart = canvas._chart = null; }
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = mapped;
      chart.options.plugins = options.plugins;
      chart.options.scales = options.scales;
      chart.update();
    } else {
      chart = new Chart(canvas.getContext("2d"), { type: "line", data: { labels, datasets: mapped }, options });
      canvas._chart = chart;
    }

    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${opts.title || "Line chart"}: ${datasets.map((d) => d.label).join(", ")}, ${labels[0]}–${labels[labels.length - 1]}.`);
    _toolbar(card, chart, { filename: opts.filename, csv: _csv(labels, datasets, opts.filename) });
    _table(card, labels, datasets, (v) => valueFmt(v));
    return chart;
  }

  /** Horizontal 100% stacked bars. rows: [{label, values: {key: share 0-100}}]; keys with colours. */
  function stackRows(canvasId, { rows, keys }, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const card = _card(canvas);
    const labels = rows.map((r) => r.label);
    const datasets = keys.map((k) => ({
      label: k.label,
      data: rows.map((r) => (r.values ? r.values[k.key] : null)),
      backgroundColor: k.color,
      borderColor: "#ffffff",
      borderWidth: { left: 1, right: 1, top: 0, bottom: 0 },
      borderSkipped: false,
      borderRadius: 2,
      barPercentage: 0.78,
      categoryPercentage: 0.9,
      labelInk: k.ink || INK,
    }));
    const options = {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 350 },
      layout: { padding: { top: 4, right: 8, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: true, position: "top", align: "start",
                  labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, padding: 14,
                            font: { family: FONT, size: 11.5, weight: 500 }, color: INK_2 } },
        tooltip: { ..._tooltip, mode: "index", intersect: false,
                   callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.x == null ? "–" : c.parsed.x.toFixed(1) + "%"}`,
                                footer: (items) => { const r = rows[items[0].dataIndex]; return r && r.note ? r.note : ""; } } },
        segmentLabels: { enabled: true },
        endLabels: { enabled: false },
      },
      scales: {
        x: { stacked: true, min: 0, max: 100, grid: { color: GRID }, border: { display: false },
             ticks: { color: MUTED, callback: (v) => v + "%", font: { size: 11 } } },
        y: { stacked: true, grid: { display: false }, border: { display: false },
             ticks: { color: INK_2, font: { size: 11.5, weight: 600 } } },
      },
    };
    let chart = canvas._chart;
    if (chart && chart.config.type === "bar") {
      chart.data.labels = labels; chart.data.datasets = datasets; chart.update();
    } else {
      if (chart) chart.destroy();
      chart = new Chart(canvas.getContext("2d"), { type: "bar", data: { labels, datasets }, options });
      canvas._chart = chart;
    }
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${opts.title || "Stacked bar chart"}: share of each domain by period.`);
    const tableSets = datasets.map((d) => ({ label: d.label, data: d.data }));
    _toolbar(card, chart, { filename: opts.filename, csv: _csv(labels, tableSets, opts.filename, "Period") });
    _table(card, labels, tableSets, (v) => (v == null ? "–" : v.toFixed(1) + "%"));
    return chart;
  }

  /** Simple vertical bar chart (e.g. number of firms per year). */
  function bars(canvasId, { labels, values, color = "#c3c2b7", label = "Value" }, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const datasets = [{ label, data: values, backgroundColor: color, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.9 }];
    const options = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { display: false }, tooltip: { ..._tooltip, callbacks: { label: (c) => ` ${label}: ${App.num(c.parsed.y)}` } },
                 endLabels: { enabled: false } },
      scales: {
        x: { grid: { display: false }, border: { color: AXIS }, ticks: { color: MUTED, font: { size: 10.5 }, maxRotation: 0, autoSkipPadding: 10 } },
        y: { beginAtZero: true, grid: { color: GRID }, border: { display: false }, ticks: { color: MUTED, font: { size: 10.5 }, maxTicksLimit: 4 } },
      },
    };
    let chart = canvas._chart;
    if (chart) { chart.data.labels = labels; chart.data.datasets = datasets; chart.update(); }
    else { chart = new Chart(canvas.getContext("2d"), { type: "bar", data: { labels, datasets }, options }); canvas._chart = chart; }
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", opts.title || label);
    return chart;
  }

  /**
   * Inline SVG sparkline. values: number|null[]; opts: {w, h, yMax, color, ref (reference series), fill, width}
   */
  function spark(values, opts = {}) {
    const w = opts.w || 240, h = opts.h || 64, pad = 3;
    const all = values.concat(opts.ref || []).filter((v) => v != null && !isNaN(v));
    const yMax = opts.yMax || Math.max(1e-9, ...all);
    const n = values.length;
    const X = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
    const Y = (v) => h - pad - (Math.min(v, yMax) / yMax) * (h - 2 * pad);
    const path = (arr) => {
      let d = "", pen = false;
      arr.forEach((v, i) => {
        if (v == null || isNaN(v)) { pen = false; return; }
        d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true;
      });
      return d;
    };
    const firstIdx = values.findIndex((v) => v != null), lastIdx = values.length - 1 - [...values].reverse().findIndex((v) => v != null);
    const area = opts.fill && firstIdx >= 0
      ? `<path d="${path(values)}L${X(lastIdx).toFixed(1)},${h - pad}L${X(firstIdx).toFixed(1)},${h - pad}Z" fill="${rgba(opts.color || INK, 0.1)}" stroke="none"/>`
      : "";
    const ref = opts.ref ? `<path d="${path(opts.ref)}" fill="none" stroke="#c9c7bf" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` : "";
    const last = lastIdx >= 0 && values[lastIdx] != null
      ? `<circle cx="${X(lastIdx).toFixed(1)}" cy="${Y(values[lastIdx]).toFixed(1)}" r="2.6" fill="${opts.color || INK}"/>` : "";
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="${pad}" x2="${w - pad}" y1="${h - pad}" y2="${h - pad}" stroke="#e1e0d9" stroke-width="1" vector-effect="non-scaling-stroke"/>
      ${area}${ref}
      <path d="${path(values)}" fill="none" stroke="${opts.color || INK}" stroke-width="${opts.width || 2}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      ${opts.dot ? last : ""}
    </svg>`;
  }

  return { line, stackRows, bars, spark, seq, seqInk, rgba, SEQ, INK, INK_2, MUTED, GRID, FONT };
})();
