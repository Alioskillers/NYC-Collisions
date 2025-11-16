// frontend/src/pages/Analytics.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Alert,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Button,
  Tooltip,
} from "@mui/material";
import PlotCard from "../components/PlotCard.jsx";
import { fetchJSON } from "../lib/api";

function ensureFigure(name, payload, fallbackBuilder, height = 420) {
  const baseLayout = {
    margin: { t: 50, r: 20, b: 60, l: 60 },
    autosize: true,
    bargap: 0.20,
    bargroupgap: 0.05,
  };

  // Helper: check if an array likely contains Plotly traces
  const looksLikeTraceArray = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const t = arr[0];
    return (
      t &&
      typeof t === "object" &&
      (
        ("x" in t) ||
        ("y" in t) ||
        ("z" in t) ||
        ("labels" in t) ||
        ("values" in t) ||
        ("type" in t)
      )
    );
  };

  // If backend already sent a Plotly spec, use it
  if (payload && looksLikeTraceArray(payload.data)) {
    return {
      data: payload.data,
      layout: {
        ...baseLayout,
        ...(payload.layout || {}),
        height: (payload.layout && payload.layout.height) || height,
      },
    };
  }

  // Otherwise, build a spec from the raw payload (e.g., {x,y} or {labels,values})
  const built = fallbackBuilder?.(payload);
  if (!built) return null;

  return {
    data: built.data || [],
    layout: {
      ...baseLayout,
      height,
      ...(built.layout || {}),
    },
  };
}

// --- Build backend-friendly filters [{ col, op, val }] ---
function buildFilters(selected) {
  const out = [];

  // Borough
  if (selected?.borough?.length) {
    out.push({ col: "borough", op: "in", val: selected.borough });
  }
  // Vehicle Type
  if (selected?.vehicle_type?.length) {
    out.push({ col: "vehicle_type", op: "in", val: selected.vehicle_type });
  }
  // Contributing Factor
  if (selected?.factor?.length) {
    out.push({ col: "factor", op: "in", val: selected.factor });
  }
  // Injury Type
  if (selected?.bodily_injury?.length) {
    out.push({ col: "bodily_injury", op: "in", val: selected.bodily_injury });
  }
  // Year(s): backend supports "contains" on strings; we match ISO dates that start with year
  if (selected?.year?.length) {
    // Build a regex like ^2020|^2021|^2022
    const rx = "^" + selected.year.map(String).join("|^");
    out.push({ col: "crash_date", op: "contains", val: rx });
  }

  return out;
}

// --- Append filters as a query param ---
function withFilters(url, filters) {
  if (!filters || !filters.length) return url;
  const f = encodeURIComponent(JSON.stringify(filters));
  return url + (url.includes("?") ? "&" : "?") + `filters=${f}`;
}

// --- Simple reusable multi-select ---
function MultiSelect({ label, value, onChange, options, placeholder = "All" }) {
  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        onChange={(e) => onChange(e.target.value)}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) =>
          selected.length ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((v) => (
                <Chip key={v} label={String(v)} size="small" />
              ))}
            </Box>
          ) : (
            <Box sx={{ color: "text.secondary" }}>{placeholder}</Box>
          )
        }
      >
        {options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {String(opt)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function Analytics() {
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Dynamic filter state ---
  const [boroughs, setBoroughs] = useState([]);
  const [years, setYears] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [factors, setFactors] = useState([]);
  const [injuryTypes, setInjuryTypes] = useState([]);

  const [selected, setSelected] = useState({
    borough: [],
    year: [],
    vehicle_type: [],
    factor: [],
    bodily_injury: [],
  });

  // Convert UI selections -> backend filters
  const filters = useMemo(() => buildFilters(selected), [selected]);

  const [figs, setFigs] = useState({
    scatter: null,
    box: null,
    hist: null,
    bar: null,
    line: null,
    corr: null,
    pie: null,
  });

  // --- Fetch distinct values for dropdowns (re-usable via existing endpoints) ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        const [boroughBar, vtBar, factorBar, injuryBar, yearLine] = await Promise.all([
          fetchJSON("/api/eda/bar?cat=borough&top=1000"),
          fetchJSON("/api/eda/bar?cat=vehicle_type&top=1000"),
          fetchJSON("/api/eda/bar?cat=factor&top=1000"),
          fetchJSON("/api/eda/bar?cat=bodily_injury&top=1000"),
          fetchJSON("/api/eda/line?date_col=crash_date&freq=Y"),
        ]);
        if (!alive) return;

        const safeLabels = (p) => (p?.data?.[0]?.x || p?.x || p?.labels || []).map(String);
        const bOpts = safeLabels(boroughBar);
        const vtOpts = safeLabels(vtBar);
        const fOpts = safeLabels(factorBar);
        const iOpts = safeLabels(injuryBar);

        const yXs = (yearLine?.data?.[0]?.x || yearLine?.x || []).map((s) => String(s).slice(0, 4));
        const yOpts = Array.from(new Set(yXs)).filter((y) => /^(19|20)\d{2}$/.test(y));

        setBoroughs(bOpts);
        setVehicleTypes(vtOpts);
        setFactors(fOpts);
        setInjuryTypes(iOpts);
        setYears(yOpts);
      } catch (e) {
        setErr(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- Fetch charts whenever filters change ---
  useEffect(() => {
    const controller = new AbortController();
    setErr("");
    setLoading(true);

    (async () => {
      const withOpts = (url) =>
        fetchJSON(withFilters(url, filters), {
          timeoutMs: 45000,
          signal: controller.signal,
        }).catch((e) => {
          throw new Error(`${url} -> ${e.message || e}`);
        });

      const calls = await Promise.allSettled([
        withOpts("/api/eda/scatter?x=latitude&y=hour&limit=3000"),
        withOpts("/api/eda/box?col=hour&by=bodily_injury"),
        withOpts("/api/eda/hist?col=hour&bins=24&from=persons"),
        withOpts("/api/eda/bar?cat=bodily_injury&top=12"),
        withOpts("/api/eda/line?date_col=crash_date&freq=M"),
        withOpts("/api/eda/corr?cols=latitude,hour"),
        withOpts("/api/eda/pie?cat=bodily_injury&top=8"),
      ]);

      const val = (i) => (calls[i].status === "fulfilled" ? calls[i].value : null);
      const failures = calls
        .filter((c) => c.status === "rejected")
        .map((c) => c.reason?.message || String(c.reason));

      const scatterFig = ensureFigure(
        "scatter",
        val(0),
        (p) =>
          p && p.x && p.y
            ? {
                data: [
                  {
                    type: "scatter",
                    mode: "markers",
                    x: p.x,
                    y: p.y,
                    marker: { size: 4, opacity: 0.5 },
                  },
                ],
                layout: { xaxis: { title: "latitude" }, yaxis: { title: "hour" } },
              }
            : null,
        500
      );

      const boxFig = ensureFigure(
        "box",
        val(1),
        (p) =>
          p && Array.isArray(p.series)
            ? {
                data: p.series.map((s) => ({
                  type: "box",
                  name: s.name ?? "Unknown",
                  y: (s.y ?? []).map(Number),
                  boxpoints: "outliers",
                  jitter: 0.3,
                  pointpos: 0,
                })),
                layout: { xaxis: { title: "bodily_injury" }, yaxis: { title: "hour" } },
              }
            : null,
        450
      );

      const histFig = ensureFigure(
        "hist",
        val(2),
        (p) =>
          p && Array.isArray(p.values)
            ? {
                data: [{
                  type: "histogram",
                  x: p.values,
                  nbinsx: p.bins ?? 24,
                  marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 } },
                  opacity: 0.9,
                }],
                layout: { xaxis: { title: "hour" }, yaxis: { title: "count" } },
              }
            : null,
        420
      );

      const barFig = ensureFigure(
        "bar",
        val(3),
        (p) =>
          p && p.x && p.y
            ? {
                data: [{
                  type: "bar",
                  x: p.x,
                  y: p.y,
                  marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 } },
                  opacity: 0.95,
                }],
                layout: { xaxis: { title: "bodily_injury" }, yaxis: { title: "count" } },
              }
            : null,
        420
      );

      const lineFig = ensureFigure(
        "line",
        val(4),
        (p) =>
          p && p.x && p.y
            ? {
                data: [{ type: "scatter", mode: "lines+markers", x: p.x, y: p.y }],
                layout: { xaxis: { title: "month" }, yaxis: { title: "count" } },
              }
            : null,
        420
      );

      const corrFig = ensureFigure(
        "corr",
        val(5),
        (p) =>
          p && p.z && p.x && p.y
            ? {
                data: [
                  {
                    type: "heatmap",
                    z: p.z,
                    x: p.x,
                    y: p.y,
                    colorscale: "RdBu",
                    reversescale: true,
                    zmin: -1,
                    zmax: 1,
                  },
                ],
                layout: { xaxis: { title: "variables" }, yaxis: { title: "variables" } },
              }
            : null,
        520
      );

      const pieFig = ensureFigure(
        "pie",
        val(6),
        (p) =>
          p && p.labels && p.values
            ? { data: [{ type: "pie", labels: p.labels, values: p.values, hole: 0.35 }] }
            : null,
        420
      );

      setFigs({
        scatter: scatterFig,
        box: boxFig,
        hist: histFig,
        bar: barFig,
        line: lineFig,
        corr: corrFig,
        pie: pieFig,
      });

      if (failures.length) setErr(failures.join(" | "));
      setLoading(false);
    })();

    return () => controller.abort("route-change");
  }, [filters]);

  const resetFilters = () =>
    setSelected({ borough: [], year: [], vehicle_type: [], factor: [], bodily_injury: [] });

  return (
    <Container maxWidth={false} sx={{ py: 0, px: 0 }}>
      {/* Filters toolbar */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <MultiSelect
            label="Borough"
            value={selected.borough}
            onChange={(v) => setSelected((s) => ({ ...s, borough: v }))}
            options={boroughs}
          />
          <MultiSelect
            label="Year"
            value={selected.year}
            onChange={(v) => setSelected((s) => ({ ...s, year: v }))}
            options={years}
          />
          <MultiSelect
            label="Vehicle Type"
            value={selected.vehicle_type}
            onChange={(v) => setSelected((s) => ({ ...s, vehicle_type: v }))}
            options={vehicleTypes}
          />
          <MultiSelect
            label="Contributing Factor"
            value={selected.factor}
            onChange={(v) => setSelected((s) => ({ ...s, factor: v }))}
            options={factors}
          />
          <MultiSelect
            label="Injury Type"
            value={selected.bodily_injury}
            onChange={(v) => setSelected((s) => ({ ...s, bodily_injury: v }))}
            options={injuryTypes}
          />
          <Tooltip title="Clear all filters">
            <span>
              <Button variant="outlined" onClick={resetFilters} disabled={loading}>
                Reset
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Box>

      {err && (
        <Alert severity="warning" sx={{ m: 2 }}>
          {err}
        </Alert>
      )}

      {figs.scatter && (
        <PlotCard
          title="Scatter: latitude vs hour"
          subtitle="X: latitude, Y: hour"
          data={figs.scatter.data}
          layout={figs.scatter.layout}
        />
      )}

      {figs.box && (
        <PlotCard
          title="Box plot by bodily_injury"
          subtitle="Y: hour grouped by bodily_injury"
          data={figs.box.data}
          layout={figs.box.layout}
        />
      )}

      {figs.hist && (
        <PlotCard
          title="Histogram: hour distribution"
          subtitle="Distribution of hour (persons)"
          data={figs.hist.data}
          layout={figs.hist.layout}
        />
      )}

      {figs.bar && (
        <PlotCard
          title="Bar chart: bodily_injury (Top 12)"
          subtitle="X: category, Y: count"
          data={figs.bar.data}
          layout={figs.bar.layout}
        />
      )}

      {figs.line && (
        <PlotCard
          title="Monthly line chart"
          subtitle="X: Month (crash_date), Y: count"
          data={figs.line.data}
          layout={figs.line.layout}
        />
      )}

      {figs.corr && (
        <PlotCard
          title="Correlation heatmap"
          subtitle="Corr(latitude, hour, ...)"
          data={figs.corr.data}
          layout={figs.corr.layout}
        />
      )}

      {figs.pie && (
        <PlotCard title="Pie: bodily_injury share (Top 8)" data={figs.pie.data} layout={figs.pie.layout} />
      )}
    </Container>
  );
}