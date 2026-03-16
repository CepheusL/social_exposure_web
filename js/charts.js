/* ============ charts.js — Chart.js wrappers ============ */

const Charts = (() => {
  const COLORS = ["#8ECFC9","#FFBE7A","#FA7F6F","#82B0D2","#BEB8DC","#E7DAD2"];

  const MEASURE_COLOR_MAP = {
    "Employee Welfare":       "#8ECFC9",
    "DEI":                    "#FFBE7A",
    "Stakeholder Outreach":   "#FA7F6F",
    "Ethical Commitment":     "#82B0D2",
    "Crisis Response":        "#BEB8DC",
    "Overall Social Exposure":"#E7DAD2",
  };

  function getColor(i)       { return COLORS[i % COLORS.length]; }
  function getMeasureColor(l){ return MEASURE_COLOR_MAP[l] || null; }

  const GRID_COLOR  = "rgba(20,20,19,0.04)";
  const TICK_COLOR  = "#b0aea5";
  const FONT_FAMILY = "'Poppins', Arial, sans-serif";

  // Toolbar: download PNG, download CSV (optional), copy link
  function _addToolbar(container, chart, opts = {}) {
    let tb = container.querySelector(".chart-toolbar");
    if (!tb) {
      tb = document.createElement("div");
      tb.className = "chart-toolbar";
      container.appendChild(tb);
    }
    tb.innerHTML = "";

    // PNG
    const btnPng = document.createElement("button");
    btnPng.className = "chart-btn";
    btnPng.innerHTML = "&#x2B07; PNG";
    btnPng.title = "Download chart as image";
    btnPng.addEventListener("click", () => {
      const url = chart.toBase64Image("image/png", 1);
      const a = document.createElement("a");
      a.href = url;
      a.download = (opts.filename || "chart") + ".png";
      a.click();
      App.toast("Image downloaded");
    });
    tb.appendChild(btnPng);

    // CSV (if data provider given)
    if (opts.csvFn) {
      const btnCsv = document.createElement("button");
      btnCsv.className = "chart-btn";
      btnCsv.innerHTML = "&#x2B07; CSV";
      btnCsv.title = "Download chart data as CSV";
      btnCsv.addEventListener("click", opts.csvFn);
      tb.appendChild(btnCsv);
    }

    // Copy link
    const btnLink = document.createElement("button");
    btnLink.className = "chart-btn";
    btnLink.innerHTML = "&#x1F517; Link";
    btnLink.title = "Copy shareable link";
    btnLink.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => App.toast("Link copied!"));
    });
    tb.appendChild(btnLink);
  }

  // Build CSV blob and trigger download from chart labels + datasets
  function _csvFromChart(labels, datasets, filename) {
    const headers = ["Year", ...datasets.map(d => d.label || "Value")];
    const rows = labels.map((lbl, i) => [lbl, ...datasets.map(d => d.data[i] ?? "")]);
    const csv  = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = (filename || "data") + ".csv"; a.click();
    URL.revokeObjectURL(url);
    App.toast("CSV downloaded");
  }

  /** Line chart: creates or smoothly updates in-place */
  function lineChart(canvasId, { labels, datasets, yLabel = "", xLabel = "Year" }, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const container = canvas.closest(".chart-container");

    const mappedDatasets = datasets.map((ds, i) => {
      const color = ds.color || getMeasureColor(ds.label) || getColor(i);
      return {
        label:               ds.label,
        data:                ds.data,
        borderColor:         color,
        backgroundColor:     color + "18",
        borderWidth:         2.5,
        pointRadius:         2.5,
        pointHoverRadius:    5,
        pointBackgroundColor: color,
        pointBorderColor:    "#fff",
        pointBorderWidth:    1.5,
        pointHoverBorderWidth: 2,
        tension:             0.2,
        fill:                datasets.length === 1,
        spanGaps:            true,
        _meta:               ds.meta || null,
        ...(ds.extra || {}),
      };
    });

    const existing = canvas._chartInstance;

    // Smooth in-place update if chart already exists
    if (existing) {
      existing.data.labels   = labels;
      existing.data.datasets = mappedDatasets;
      existing.options.scales.y.title.text = yLabel;
      existing.update("active");

      if (container) _addToolbar(container, existing, {
        filename: opts.filename || "chart",
        csvFn: () => _csvFromChart(labels, datasets, opts.filename || "data"),
      });
      return existing;
    }

    const ctx   = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: mappedDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400, easing: "easeInOutQuart" },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: "top",
            labels: {
              usePointStyle: true, pointStyle: "circle",
              padding: 16,
              font: { family: FONT_FAMILY, size: 11, weight: 600 },
              color: TICK_COLOR,
            },
          },
          tooltip: {
            backgroundColor: "rgba(20,20,19,0.92)",
            titleFont: { family: FONT_FAMILY, size: 12, weight: 700 },
            bodyFont:  { family: FONT_FAMILY, size: 11 },
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 8, boxPadding: 4,
            callbacks: {
              afterBody: (items) => {
                const ds0 = mappedDatasets[0];
                if (ds0 && ds0._meta) {
                  const m = ds0._meta[items[0].dataIndex];
                  if (m && m.nfirm !== undefined) return `Firms: ${m.nfirm.toLocaleString()}`;
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: !!xLabel, text: xLabel, font:{ family:FONT_FAMILY,size:11,weight:600 }, color:TICK_COLOR },
            grid:  { display: false },
            ticks: { font:{ family:FONT_FAMILY,size:10 }, color:TICK_COLOR },
            border:{ color:"rgba(20,20,19,0.08)" },
          },
          y: {
            title: { display: !!yLabel, text: yLabel, font:{ family:FONT_FAMILY,size:11,weight:600 }, color:TICK_COLOR },
            beginAtZero: false,
            grid:  { color: GRID_COLOR, lineWidth: 1 },
            ticks: { font:{ family:FONT_FAMILY,size:10 }, color:TICK_COLOR, padding:6 },
            border:{ display: false },
          },
        },
        layout: { padding: { top:4, right:8, bottom:0, left:0 } },
      },
    });

    canvas._chartInstance = chart;

    if (container) _addToolbar(container, chart, {
      filename: opts.filename || "chart",
      csvFn: () => _csvFromChart(labels, datasets, opts.filename || "data"),
    });

    return chart;
  }

  /** Bar chart */
  function barChart(canvasId, { labels, values, colors, yLabel = "", xLabel = "" }, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const container = canvas.closest(".chart-container");

    const mappedDatasets = [{
      data: values,
      backgroundColor: colors || labels.map((_, i) => getColor(i) + "cc"),
      borderColor:     colors ? colors : labels.map((_, i) => getColor(i)),
      borderWidth: 1, borderRadius: 4,
    }];

    const existing = canvas._chartInstance;
    if (existing) {
      existing.data.labels   = labels;
      existing.data.datasets = mappedDatasets;
      existing.options.scales.y.title.text = yLabel;
      existing.update("active");
      if (container) _addToolbar(container, existing, { filename: opts.filename || "chart" });
      return existing;
    }

    const ctx   = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: mappedDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(20,20,19,0.92)",
            titleFont: { family:FONT_FAMILY, size:12, weight:700 },
            bodyFont:  { family:FONT_FAMILY, size:11 },
            padding: { top:8, bottom:8, left:12, right:12 },
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            title: { display:!!xLabel, text:xLabel, font:{family:FONT_FAMILY,size:11,weight:600}, color:TICK_COLOR },
            grid:  { display:false },
            ticks: { font:{family:FONT_FAMILY,size:10}, color:TICK_COLOR },
            border:{ color:"rgba(20,20,19,0.08)" },
          },
          y: {
            title: { display:!!yLabel, text:yLabel, font:{family:FONT_FAMILY,size:11,weight:600}, color:TICK_COLOR },
            beginAtZero: false,
            grid:  { color:GRID_COLOR, lineWidth:1 },
            ticks: { font:{family:FONT_FAMILY,size:10}, color:TICK_COLOR, padding:6 },
            border:{ display:false },
          },
        },
        layout: { padding: { top:4, right:8, bottom:0, left:0 } },
      },
    });

    canvas._chartInstance = chart;
    if (container) _addToolbar(container, chart, { filename: opts.filename || "chart" });
    return chart;
  }

  return { lineChart, barChart, getColor, getMeasureColor, COLORS, MEASURE_COLOR_MAP };
})();
