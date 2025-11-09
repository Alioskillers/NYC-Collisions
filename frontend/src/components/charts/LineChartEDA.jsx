import React from "react";
import Plot from "react-plotly.js";

export default function LineChartEDA({ title, endpoint }) {
  const [xy, setXY] = React.useState({ x: [], y: [] });
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setXY({
          x: Array.isArray(data.x) ? data.x : [],
          y: Array.isArray(data.y) ? data.y.map(Number) : [],
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => (alive = false);
  }, [endpoint]);

  if (err) return <div className="text-red-600">Line error: {err}</div>;
  if (loading) return <div>Loading…</div>;

  return (
    <Plot
      data={[
        {
          type: "scatter",              // <- NOT scattergl
          mode: "lines+markers",
          x: xy.x,
          y: xy.y,
          hovertemplate: "%{x}: %{y:,}<extra></extra>",
        },
      ]}
      layout={{
        title,
        margin: { l: 50, r: 20, t: 40, b: 60 },
        xaxis: { automargin: true },
        yaxis: { automargin: true, rangemode: "tozero" },
      }}
      config={{ responsive: true }}
      style={{ width: "100%", height: 420 }}
    />
  );
}