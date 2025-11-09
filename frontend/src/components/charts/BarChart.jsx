import React from "react";
import Plot from "react-plotly.js";

export default function BarChart({ title, endpoint }) {
  const [loading, setLoading] = React.useState(true);
  const [xy, setXY] = React.useState({ x: [], y: [] });
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        // Backend returns { x:[categories], y:[counts] } (plus maybe data:[{category,count}])
        const x = Array.isArray(data.x) ? data.x : [];
        const y = Array.isArray(data.y) ? data.y.map(Number) : [];
        setXY({ x, y });
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => (alive = false);
  }, [endpoint]);

  if (err) return <div className="text-red-600">Bar error: {err}</div>;
  if (loading) return <div>Loading…</div>;

  return (
    <Plot
      data={[
        {
          type: "bar",
          x: xy.x,
          y: xy.y,
          hovertemplate: "%{x}: %{y:,}<extra></extra>",
        },
      ]}
      layout={{
        title,
        margin: { l: 50, r: 20, t: 40, b: 80 },
        xaxis: { automargin: true, tickangle: -30 },
        yaxis: { automargin: true, rangemode: "tozero" },
      }}
      config={{ responsive: true, displayModeBar: true }}
      style={{ width: "100%", height: 420 }}
    />
  );
}