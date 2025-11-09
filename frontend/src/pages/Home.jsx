// frontend/src/pages/Home.jsx
import { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

function KPI({ label, value }) {
  const isNum = Number.isFinite(value);
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(4px)",
      }}
    >
      <CardContent sx={{ p: 2.5, textAlign: "center" }}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
          {isNum ? value.toLocaleString() : "—"}
        </Typography>
      </CardContent>
    </Card>
  );
}

// safe numeric coercion for API values
const toNum = (v, fallback = 0) => {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function Home() {
  const [kpis, setKpis] = useState({ collisions: 0, injuries: 0, fatalities: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/summary", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const k = d?.kpis || d || {};

        // robust mapping + numeric coercion
        const collisions = toNum(
          k.collisions ?? k.total_crashes ?? k.crashes ?? k.rows ?? k.total ?? 0
        );
        const injuries = toNum(
          k.injuries ?? k.injured_sum ?? k.injured ?? k.total_injured ?? 0
        );
        const fatalities = toNum(
          k.fatalities ?? k.killed_sum ?? k.killed ?? k.total_killed ?? 0
        );

        setKpis({ collisions, injuries, fatalities });
      })
      .catch(() => setKpis({ collisions: 0, injuries: 0, fatalities: 0 }));

    return () => controller.abort();
  }, []);

  return (
    <>
      <Box
        sx={{
          height: "100vh",
          width: "100%",
          position: "relative",
          backgroundImage: "url(/images/Home_Page.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        {/* Dark overlay */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.25))",
          }}
        />

        {/* Content */}
        <Container
          maxWidth="md"
          sx={{ position: "relative", zIndex: 2, textAlign: "center" }}
        >
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            NYC Collision Analytics
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: "rgba(255,255,255,0.9)",
              maxWidth: 700,
              mb: 4,
              mx: "auto",
              textAlign: "center",
            }}
          >
            Every year, millions of people travel through the streets of New York City.
            But beneath the movement of taxis, bikes, buses, and pedestrians lies an unfolding
            story of collisions, near-misses, and preventable harm. Using open data reported by
            the NYPD, this dashboard transforms raw crash records into insight — helping us
            understand when accidents occur, where risks increase, and which factors contribute
            most to injuries and fatalities.
            <br /><br />
            Explore key indicators, visualize patterns, and reveal trends across the boroughs
            and neighborhoods that make up the world’s busiest city.
          </Typography>

          {/* KPIs Centered */}
          <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
            <Grid item xs={10} sm={6} md={3}>
              <KPI label="Total Collisions" value={kpis.collisions} />
            </Grid>
            <Grid item xs={10} sm={6} md={3}>
              <KPI label="Injuries" value={kpis.injuries} />
            </Grid>
            <Grid item xs={10} sm={6} md={3}>
              <KPI label="Fatalities" value={kpis.fatalities} />
            </Grid>
          </Grid>

          <Button variant="contained" size="large" onClick={() => navigate("/analytics")}>
            View Analytics
          </Button>
        </Container>
      </Box>
    </>
  );
}