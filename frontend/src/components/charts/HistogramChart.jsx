import Plot from "react-plotly.js";

export default function HistogramChart({ data }) {
  if (!data) return null;

  if (data.type === "categorical") {
    const labels = Array.isArray(data.labels) ? data.labels : [];
    const values = Array.isArray(data.values) ? data.values : [];
    if (!labels.length || !values.length) return null;

    return (
      <Plot
        data={[{ x: labels, y: values, type: "bar" }]}
        layout={{
          title: `Histogram (categorical): ${data.col}`,
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          xaxis: { tickangle: -30 },
          yaxis: { title: "Count", rangemode: "tozero", separatethousands: true },
          margin: { t: 40, r: 10, b: 100, l: 60 },
          height: 360,
        }}
        style={{ width: "100%" }}
        useResizeHandler
      />
    );
  }

  const x = Array.isArray(data.x) ? data.x : [];
  const y = Array.isArray(data.y) ? data.y : [];
  if (!x.length || !y.length) return null;

  return (
    <Plot
      data={[{ x, y, type: "bar" }]}
      layout={{
        title:
          data.type === "numeric_int_domain"
            ? `Histogram (integer domain): ${data.col}`
            : `Histogram: ${data.col}`,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: {
          title: data.col,
          tickmode: data.type === "numeric_int_domain" ? "linear" : "auto",
        },
        yaxis: { title: "Count", rangemode: "tozero", separatethousands: true },
        margin: { t: 40, r: 10, b: 60, l: 60 },
        height: 360,
      }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}