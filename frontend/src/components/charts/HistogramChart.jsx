import Plot from "react-plotly.js";

/**
 * Clean, responsive histogram component.
 * Accepts shapes returned by the backend:
 *  1) { type: "categorical", labels:[], values:[], col }
 *  2) { values: number[], bins?: number, col }   // raw numeric values
 *  3) { x:[], y:[], type?: "numeric_int_domain", col }  // pre-binned
 */
export default function HistogramChart({ data }) {
  if (!data) return null;

  // Small helpers
  const isHourCol =
    typeof data.col === "string" &&
    data.col.toLowerCase().includes("hour");

  // Common "clean" layout used across variants
  const baseLayout = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    showlegend: false,
    bargap: 0.20,
    bargroupgap: 0.05,
    margin: { t: 40, r: 10, b: 60, l: 60 },
    height: 360,
    xaxis: {
      title: data.col ?? "",
      tickmode: isHourCol ? "linear" : "auto",
      tick0: isHourCol ? 0 : undefined,
      dtick: isHourCol ? 1 : undefined,
      range: isHourCol ? [0, 23] : undefined,
      gridcolor: "rgba(0,0,0,0.06)",
      zerolinecolor: "rgba(0,0,0,0.06)",
    },
    yaxis: {
      title: "Count",
      rangemode: "tozero",
      separatethousands: true,
      gridcolor: "rgba(0,0,0,0.06)",
      zerolinecolor: "rgba(0,0,0,0.06)",
    },
  };

  const commonConfig = {
    responsive: true,
    displayModeBar: "hover",
    modeBarButtonsToRemove: [
      "toImage",
      "select2d",
      "lasso2d",
      "autoScale2d",
      "hoverCompareCartesian",
      "toggleSpikelines",
    ],
  };

  // ---- 1) Categorical histogram (bar over categories) ----
  if (data.type === "categorical") {
    const labels = Array.isArray(data.labels) ? data.labels : [];
    const values = Array.isArray(data.values) ? data.values : [];
    if (!labels.length || !values.length) return null;

    return (
      <Plot
        data={[
          {
            x: labels,
            y: values,
            type: "bar",
            marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 }, opacity: 0.9 },
            hovertemplate: `%{x}<br>Count: %{y}<extra></extra>`,
          },
        ]}
        layout={{
          ...baseLayout,
          title: `Histogram (categorical): ${data.col ?? ""}`,
          xaxis: {
            ...baseLayout.xaxis,
            tickangle: -30,
          },
        }}
        config={commonConfig}
        style={{ width: "100%" }}
        useResizeHandler
      />
    );
  }

  // ---- 2) Numeric RAW values -> use Plotly histogram trace ----
  if (Array.isArray(data.values)) {
    const values = data.values.filter((v) => Number.isFinite(v));
    if (!values.length) return null;

    const nbinsx = Number.isFinite(data.bins) ? data.bins : 30;

    return (
      <Plot
        data={[
          {
            x: values,
            type: "histogram",
            nbinsx,
            marker: {
              color: "#2E6CCF",
              line: { color: "rgba(0,0,0,0.25)", width: 1 },
              opacity: 0.85,
            },
            hovertemplate: `${data.col ?? "Value"}: %{x}<br>Count: %{y}<extra></extra>`,
          },
        ]}
        layout={{
          ...baseLayout,
          title: `Histogram: ${data.col ?? ""}`,
        }}
        config={commonConfig}
        style={{ width: "100%" }}
        useResizeHandler
      />
    );
  }

  // ---- 3) Legacy numeric COUNTS (pre-binned x/y) ----
  const x = Array.isArray(data.x) ? data.x : [];
  const y = Array.isArray(data.y) ? data.y : [];
  if (!x.length || !y.length) return null;

  return (
    <Plot
      data={[
        {
          x,
          y,
          type: "bar",
          marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 }, opacity: 0.9 },
          hovertemplate: `${data.col ?? "Value"}: %{x}<br>Count: %{y}<extra></extra>`,
        },
      ]}
      layout={{
        ...baseLayout,
        title:
          data.type === "numeric_int_domain"
            ? `Histogram (integer domain): ${data.col ?? ""}`
            : `Histogram: ${data.col ?? ""}`,
        xaxis: {
          ...baseLayout.xaxis,
          tickmode: data.type === "numeric_int_domain" ? "linear" : baseLayout.xaxis.tickmode,
        },
      }}
      config={commonConfig}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}