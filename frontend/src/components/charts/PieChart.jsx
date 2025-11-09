import Plot from "react-plotly.js";

export default function PieChart({ data }) {
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const values = Array.isArray(data?.values) ? data.values : [];
  if (!labels.length || !values.length) return null;

  return (
    <Plot
      data={[{ labels, values, type: "pie", hole: 0.35 }]}
      layout={{
        title: `Pie: ${data?.cat || ""}`,
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        margin: { t: 40, r: 10, b: 10, l: 10 },
        height: 360,
      }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}