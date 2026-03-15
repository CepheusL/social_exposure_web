/* ============ charts.js — Chart.js wrapper helpers ============ */

const Charts = (() => {
  const COLORS = [
    "#8ECFC9", "#FFBE7A", "#FA7F6F", "#82B0D2", "#BEB8DC", "#E7DAD2",
  ];

  /* Consistent measure→color mapping so the same measure always gets the same color */
  const MEASURE_COLOR_MAP = {
    "Employee Welfare": COLORS[0],
    "DEI": COLORS[1],
    "Stakeholder Outreach": COLORS[2],
    "Ethical Commitment": COLORS[3],
    "Crisis Response": COLORS[4],
    "Overall Social Exposure": COLORS[5],
  };

  function getColor(i) {
    return COLORS[i % COLORS.length];
  }

  function getMeasureColor(label) {
    return MEASURE_COLOR_MAP[label] || null;
  }

  /* Shared defaults for cleaner axes */
  const GRID_COLOR = "rgba(0,0,0,0.04)";
  const TICK_COLOR = "#8d96a5";
  const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  /** Create or update a line chart */
  function lineChart(canvasId, { labels, datasets, yLabel = "", xLabel = "Year" }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Destroy existing
    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: datasets.map((ds, i) => {
          const color = ds.color || getMeasureColor(ds.label) || getColor(i);
          return {
            label: ds.label,
            data: ds.data,
            borderColor: color,
            backgroundColor: color + "18",
            borderWidth: 2.5,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            pointBorderColor: "#fff",
            pointBorderWidth: 1.5,
            pointHoverBorderWidth: 2,
            tension: 0.2,
            fill: datasets.length === 1,
            spanGaps: true,
            ...ds.extra,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              font: { family: FONT_FAMILY, size: 12, weight: 500 },
              color: TICK_COLOR,
            },
          },
          tooltip: {
            backgroundColor: "rgba(26,35,50,0.92)",
            titleFont: { family: FONT_FAMILY, size: 12, weight: 600 },
            bodyFont: { family: FONT_FAMILY, size: 12 },
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              afterBody: (items) => {
                if (datasets[0] && datasets[0].meta) {
                  const idx = items[0].dataIndex;
                  const meta = datasets[0].meta[idx];
                  if (meta) {
                    const lines = [];
                    if (meta.nfirm !== undefined) lines.push(`Firms: ${meta.nfirm.toLocaleString()}`);
                    return lines.join("\n");
                  }
                }
                return "";
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: !!xLabel, text: xLabel, font: { family: FONT_FAMILY, size: 12, weight: 500 }, color: TICK_COLOR },
            grid: { display: false },
            ticks: { font: { family: FONT_FAMILY, size: 11 }, color: TICK_COLOR },
            border: { color: "rgba(0,0,0,0.08)" },
          },
          y: {
            title: { display: !!yLabel, text: yLabel, font: { family: FONT_FAMILY, size: 12, weight: 500 }, color: TICK_COLOR },
            beginAtZero: false,
            grid: { color: GRID_COLOR, lineWidth: 1 },
            ticks: { font: { family: FONT_FAMILY, size: 11 }, color: TICK_COLOR, padding: 6 },
            border: { display: false },
          },
        },
        layout: {
          padding: { top: 4, right: 8, bottom: 0, left: 0 },
        },
      },
    });

    canvas._chartInstance = chart;
    return chart;
  }

  /** Create or update a bar chart */
  function barChart(canvasId, { labels, values, colors, yLabel = "", xLabel = "" }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors || labels.map((_, i) => getColor(i) + "cc"),
          borderColor: colors ? colors.map(c => c) : labels.map((_, i) => getColor(i)),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26,35,50,0.92)",
            titleFont: { family: FONT_FAMILY, size: 12, weight: 600 },
            bodyFont: { family: FONT_FAMILY, size: 12 },
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            title: { display: !!xLabel, text: xLabel, font: { family: FONT_FAMILY, size: 12, weight: 500 }, color: TICK_COLOR },
            grid: { display: false },
            ticks: { font: { family: FONT_FAMILY, size: 11 }, color: TICK_COLOR },
            border: { color: "rgba(0,0,0,0.08)" },
          },
          y: {
            title: { display: !!yLabel, text: yLabel, font: { family: FONT_FAMILY, size: 12, weight: 500 }, color: TICK_COLOR },
            beginAtZero: false,
            grid: { color: GRID_COLOR, lineWidth: 1 },
            ticks: { font: { family: FONT_FAMILY, size: 11 }, color: TICK_COLOR, padding: 6 },
            border: { display: false },
          },
        },
        layout: {
          padding: { top: 4, right: 8, bottom: 0, left: 0 },
        },
      },
    });

    canvas._chartInstance = chart;
    return chart;
  }

  return { lineChart, barChart, getColor, getMeasureColor, COLORS, MEASURE_COLOR_MAP };
})();
