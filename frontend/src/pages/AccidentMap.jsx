// frontend/src/pages/AccidentMap.jsx
import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import Plot from "react-plotly.js";

export default function AccidentMap() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchPoints() {
      try {
        setLoading(true);
        setError("");

        // Call your backend EDA scatter endpoint directly with fetch
        const url =
          "/api/eda/scatter?x=longitude&y=latitude&limit=3000";

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (!cancelled) {
          // Backend returns array of { x, y }
          setPoints(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[AccidentMap] Error loading points:", err);
          setError("Failed to load accident locations. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPoints();
    return () => {
      cancelled = true;
    };
  }, []);

  const lats = points.map((p) => p.y); // y = latitude
  const lons = points.map((p) => p.x); // x = longitude

  return (
    <Box
      sx={{
        bgcolor: "#f5f5f5",
        minHeight: "100vh",
        py: 4,
      }}
    >
      <Container maxWidth="xl">
        <Typography variant="h4" gutterBottom fontWeight={600}>
          NYC Collision Map
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Each point represents the location of a recorded collision in the dataset.
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <Paper
            elevation={3}
            sx={{
              p: 1,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Plot
              data={[
                {
                  type: "scattermapbox",
                  lat: lats,
                  lon: lons,
                  mode: "markers",
                  marker: {
                    size: 6,
                    opacity: 0.6,
                  },
                  hoverinfo: "none",
                },
              ]}
              layout={{
                mapbox: {
                  style: "open-street-map",
                  center: { lat: 40.7128, lon: -74.006 },
                  zoom: 9,
                },
                margin: { t: 0, b: 0, l: 0, r: 0 },
                autosize: true,
                showlegend: false,
              }}
              config={{
                responsive: true,
                scrollZoom: true,
                displayModeBar: true,
              }}
              style={{ width: "100%", height: "80vh" }}
            />
          </Paper>
        )}
      </Container>
    </Box>
  );
}