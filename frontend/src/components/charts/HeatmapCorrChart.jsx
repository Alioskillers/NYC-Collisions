import React from "react";
import Plot from "react-plotly.js";

export default function HeatmapCorrChart({ title, endpoint }) {
  const [dataState, setDataState] = React.useState({ z: [], x: [], y: [] });
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setDataState({
          z: Array.isArray(data.z) ? data.z : [],
          x: Array.isArray(data.x) ? data.x : [],
          y: Array.isArray(data.y) ? data.y : [],
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

  if (err) return <div className="text-red-600">Heatmap error: {err}</div>;
  if (loading) return <div>Loading…</div>;

  return (
    <Plot
      data={[
        {
          type: "heatmap",              // <- NOT heatmapgl
          z: dataState.z,
          x: dataState.x,
          y: dataState.y,
          zmin: -1,
          zmax: 1,
          colorscale: "RdBu",
          reversescale: true,
          hovertemplate: "%{x} vs %{y}: %{z:.2f}<extra></extra>",
        },
      ]}
      layout={{
        title,
        margin: { l: 80, r: 20, t: 40, b: 80 },
        xaxis: { side: "top", automargin: true },
        yaxis: { automargin: true },
      }}
      config={{ responsive: true }}
      style={{ width: "100%", height: 420 }}
    />
  );
}