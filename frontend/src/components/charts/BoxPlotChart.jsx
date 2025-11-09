import React from "react";
import Plot from "react-plotly.js";

export default function BoxPlotChart({ title, endpoint }) {
  const [series, setSeries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        // Backend returns { series: [ { name, y:[values] }, ... ] }
        const s = Array.isArray(data.series) ? data.series : [];
        setSeries(s);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => (alive = false);
  }, [endpoint]);

  if (err) return <div className="text-red-600">Box error: {err}</div>;
  if (loading) return <div>Loading…</div>;

  const traces = series.map((s) => ({
    type: "box",
    name: s.name ?? "Unknown",
    y: (s.y ?? []).map(Number),
    boxpoints: "outliers",
    jitter: 0.3,
    pointpos: 0,
    hovertemplate: "%{y}<extra>" + (s.name ?? "Unknown") + "</extra>",
  }));

  return (
    <Plot
      data={traces}
      layout={{
        title,
        margin: { l: 60, r: 20, t: 40, b: 120 },
        yaxis: { automargin: true },
        xaxis: { automargin: true },
        showlegend: false,
      }}
      config={{ responsive: true }}
      style={{ width: "100%", height: 420 }}
    />
  );
}