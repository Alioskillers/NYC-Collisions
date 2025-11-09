import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

export default function ScatterChart() {
  const [dataXY, setDataXY] = useState({ x: [], y: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = `/api/eda/scatter?x=latitude&y=hour&limit=3000`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setDataXY({ x: d.x || [], y: d.y || [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading scatter…</div>;

  return (
    <Plot
      data={[
        {
          type: 'scatter',          // <- was 'scattergl'
          mode: 'markers',
          x: dataXY.x,
          y: dataXY.y,
          marker: { size: 4, opacity: 0.6 },
          hovertemplate: 'lat: %{x:.5f}<br>hour: %{y}<extra></extra>',
        },
      ]}
      layout={{
        title: 'Latitude vs Hour',
        xaxis: { title: 'Latitude' },
        yaxis: { title: 'Hour (0–23)' },
        margin: { l: 50, r: 10, t: 40, b: 40 },
        autosize: true,
      }}
      config={{
        responsive: true,
        // Ensures SVG renderer is used
        // (no special option needed beyond avoiding *gl traces)
      }}
      style={{ width: '100%', height: 400 }}
      useResizeHandler
    />
  );
}