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
  Skeleton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const nf = new Intl.NumberFormat();

function KPI({ label, value, loading }) {
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
        {loading ? (
          <Skeleton
            variant="text"
            width={90}
            height={36}
            sx={{ mx: "auto", my: 0.5 }}
          />
        ) : (
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
            {isNum ? nf.format(value) : "—"}
          </Typography>
        )}
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
  const [kpis, setKpis] = useState({
    collisions: 0,
    injuries: 0,
    fatalities: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const r = await fetch("/api/summary", { signal: controller.signal });
        const d = await r.json();

        // Preferred shape from backend:
        // { total_collisions, total_injuries, total_fatalities }
        // Fallbacks to be robust with older responses.
        const collisions = toNum(
          d.total_collisions ??
            d.collisions ??
            d.total_crashes ??
            d.crashes ??
            d.rows ??
            d.total ??
            d?.kpis?.collisions ??
            0
        );
        const injuries = toNum(
          d.total_injuries ??
            d.injuries ??
            d.injured_sum ??
            d.total_injured ??
            d?.kpis?.injuries ??
            0
        );
        const fatalities = toNum(
          d.total_fatalities ??
            d.fatalities ??
            d.killed_sum ??
            d.total_killed ??
            d?.kpis?.fatalities ??
            0
        );

        setKpis({ collisions, injuries, fatalities });
      } catch (e) {
        // non-fatal: keep zeros
        console.warn("summary fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();

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
            <br />
            <br />
            Explore key indicators, visualize patterns, and reveal trends across the boroughs
            and neighborhoods that make up the world’s busiest city.
          </Typography>

          {/* KPIs Centered */}
          <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
            <Grid item xs={10} sm={6} md={3}>
              <KPI
                label="Total Collisions"
                value={kpis.collisions}
                loading={loading}
              />
            </Grid>
            <Grid item xs={10} sm={6} md={3}>
              <KPI label="Injuries" value={kpis.injuries} loading={loading} />
            </Grid>
            <Grid item xs={10} sm={6} md={3}>
              <KPI
                label="Fatalities"
                value={kpis.fatalities}
                loading={loading}
              />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            size="large"
            onClick={() => navigate("/analytics")}
          >
            View Analytics
          </Button>
          <Button color="inherit" size="large" sx={{ ml: 2 }} onClick={() => navigate("/map")}>
  Map
</Button>
        </Container>
      </Box>
    </>
  );
}