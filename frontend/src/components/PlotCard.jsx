import React from "react";
import Plot from "react-plotly.js";
import { Card, CardContent, Typography, Box } from "@mui/material";

export default function PlotCard({
  title,
  subtitle,
  data,
  layout = {},
  config = {},
  height = 420,
}) {
  const mergedLayout = {
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    autosize: true,
    margin: { t: 56, r: 24, b: 56, l: 64 },
    font: { size: 12 },
    ...layout,
  };

  const mergedConfig = {
    responsive: true,
    displaylogo: false,
    // mode bar is helpful during EDA, keep it visible:
    displayModeBar: true,
    ...config,
  };

  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        {title && (
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ width: "100%" }}>
          {isEmpty ? (
            <Typography variant="body2" color="text.secondary">
              No data to display.
            </Typography>
          ) : (
            <Plot
              data={data}
              layout={{ ...mergedLayout, height }}
              config={mergedConfig}
              useResizeHandler
              style={{ width: "100%", minHeight: height }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}