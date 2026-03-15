/* ============ charts.js — Chart.js wrapper helpers ============ */

const Charts = (() => {
  const COLORS = [
    "#8ECFC9", "#FFBE7A", "#FA7F6F", "#82B0D2", "#BEB8DC", "#E7DAD2",
  ];

  function getColor(i) {
    return COLORS[i % COLORS.length];
  }

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
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color || getColor(i),
          backgroundColor: (ds.color || getColor(i)) + "20",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: datasets.length === 1,
          spanGaps: true,
          ...ds.extra,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, position: "top" },
          tooltip: {
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
          x: { title: { display: !!xLabel, text: xLabel }, grid: { display: false } },
          y: { title: { display: !!yLabel, text: yLabel }, beginAtZero: false },
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
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: !!xLabel, text: xLabel } },
          y: { title: { display: !!yLabel, text: yLabel }, beginAtZero: false },
        },
      },
    });

    canvas._chartInstance = chart;
    return chart;
  }

  return { lineChart, barChart, getColor, COLORS };
})();
