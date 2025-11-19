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
  Typography,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PlotCard from "../components/PlotCard.jsx";
import { fetchJSON } from "../lib/api";

function ensureFigure(name, payload, fallbackBuilder, height = 420) {
  const baseLayout = {
    margin: { t: 50, r: 20, b: 60, l: 60 },
    autosize: true,
    bargap: 0.2,
    bargroupgap: 0.05,
  };

  const looksLikeTraceArray = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const t = arr[0];
    return (
      t &&
      typeof t === "object" &&
      (("x" in t) ||
        ("y" in t) ||
        ("z" in t) ||
        ("labels" in t) ||
        ("values" in t) ||
        ("type" in t))
    );
  };

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

  if (selected?.borough?.length) {
    out.push({ col: "borough", op: "in", val: selected.borough });
  }

  if (selected?.vehicle_type?.length) {
    out.push({ col: "vehicle_type", op: "in", val: selected.vehicle_type });
  }

  if (selected?.factor?.length) {
    out.push({ col: "factor", op: "in", val: selected.factor });
  }

  if (selected?.bodily_injury?.length) {
    out.push({ col: "bodily_injury", op: "in", val: selected.bodily_injury });
  }

  if (selected?.year?.length) {
    const rx = "^" + selected.year.map(String).join("|^");
    out.push({ col: "crash_date", op: "contains", val: rx });
  }

  return out;
}

// --- Append filters as a query param ---
function withFilters(url, filters) {
  if (!filters || !filters.length) return url;
  const raw = JSON.stringify(filters);
  const f = encodeURIComponent(raw);

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

const emptySelection = {
  borough: [],
  year: [],
  vehicle_type: [],
  factor: [],
  bodily_injury: [],
};

export default function Analytics() {
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Dynamic filter options ---
  const [boroughs, setBoroughs] = useState([]);
  const [years, setYears] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [factors, setFactors] = useState([]);
  const [injuryTypes, setInjuryTypes] = useState([]);

  // UI-selected filters (what user is editing in dropdowns)
  const [selected, setSelected] = useState(emptySelection);
  // Applied filters (what charts are currently using)
  const [appliedSelected, setAppliedSelected] = useState(emptySelection);

  const [search, setSearch] = useState("");

  // Convert applied selections -> backend filters
  const filters = useMemo(() => {
    const f = buildFilters(appliedSelected);
    console.log("[useMemo] appliedSelected:", appliedSelected);
    console.log("[useMemo] built filters:", f);
    return f;
  }, [appliedSelected]);

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
        console.log("[INIT] fetching dropdown options...");

        const [boroughBar, vtBar, factorBar, injuryBar, yearLine] =
          await Promise.all([
            fetchJSON("/api/eda/bar?cat=borough&top=1000"),
            fetchJSON("/api/eda/bar?cat=vehicle_type&top=1000"),
            fetchJSON("/api/eda/bar?cat=factor&top=1000"),
            fetchJSON("/api/eda/bar?cat=bodily_injury&top=1000"),
            fetchJSON("/api/eda/line?date_col=crash_date&freq=Y"),
          ]);

        if (!alive) return;

        const safeLabels = (p) =>
          (p?.data?.[0]?.x || p?.x || p?.labels || []).map(String);

        const bOpts = safeLabels(boroughBar);
        const vtOpts = safeLabels(vtBar);
        const fOpts = safeLabels(factorBar);
        const iOpts = safeLabels(injuryBar);

        const yXs = (yearLine?.data?.[0]?.x || yearLine?.x || []).map((s) =>
          String(s).slice(0, 4)
        );
        const yOpts = Array.from(new Set(yXs)).filter((y) =>
          /^(19|20)\d{2}$/.test(y)
        );

        setBoroughs(bOpts);
        setVehicleTypes(vtOpts);
        setFactors(fOpts);
        setInjuryTypes(iOpts);
        setYears(yOpts);
      } catch (e) {
        console.error("[INIT] error:", e);
        setErr(String(e?.message || e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- Fetch charts whenever APPLIED filters change ---
  useEffect(() => {
    const controller = new AbortController();
    setErr("");
    setLoading(true);

    console.log("====================================");
    console.log("[EFFECT] Fetching charts with filters:", filters);
    console.log("====================================");

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

      const val = (i) =>
        calls[i].status === "fulfilled" ? calls[i].value : null;
      const failures = calls
        .filter((c) => c.status === "rejected")
        .map((c) => c.reason?.message || String(c.reason));

      if (failures.length) {
        console.warn("[EFFECT] some calls failed:", failures);
      }

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
                layout: {
                  xaxis: { title: "latitude" },
                  yaxis: { title: "hour" },
                },
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
                layout: {
                  xaxis: { title: "bodily_injury" },
                  yaxis: { title: "hour" },
                },
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
                data: [
                  {
                    type: "histogram",
                    x: p.values,
                    nbinsx: p.bins ?? 24,
                    marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 } },
                    opacity: 0.9,
                  },
                ],
                layout: {
                  xaxis: { title: "hour" },
                  yaxis: { title: "count" },
                },
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
                data: [
                  {
                    type: "bar",
                    x: p.x,
                    y: p.y,
                    marker: { line: { color: "rgba(0,0,0,0.25)", width: 1 } },
                    opacity: 0.95,
                  },
                ],
                layout: {
                  xaxis: { title: "bodily_injury" },
                  yaxis: { title: "count" },
                },
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
                data: [
                  {
                    type: "scatter",
                    mode: "lines+markers",
                    x: p.x,
                    y: p.y,
                  },
                ],
                layout: {
                  xaxis: { title: "month" },
                  yaxis: { title: "count" },
                },
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
                layout: {
                  xaxis: { title: "variables" },
                  yaxis: { title: "variables" },
                },
              }
            : null,
        520
      );

      const pieFig = ensureFigure(
        "pie",
        val(6),
        (p) =>
          p && p.labels && p.values
            ? {
                data: [
                  {
                    type: "pie",
                    labels: p.labels,
                    values: p.values,
                    hole: 0.35,
                  },
                ],
              }
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
  }, [JSON.stringify(filters)]);

  const resetFilters = () => {
    setSelected(emptySelection);
    setAppliedSelected(emptySelection);
    setSearch("");
  };

  const activeFiltersCount = buildFilters(appliedSelected).length;

  // --- Handle natural-language search + Generate Report ---
  const handleGenerate = () => {
    let next = { ...selected };

    const q = search.trim().toLowerCase();
    if (q) {
      // Auto-detect boroughs mentioned in the query
      const bMatches = boroughs.filter((b) =>
        q.includes(String(b).toLowerCase())
      );
      if (bMatches.length) next.borough = bMatches;

      // Auto-detect years (e.g., 2019, 2020, 2022)
      const yMatches = years.filter((y) => q.includes(String(y)));
      if (yMatches.length) next.year = yMatches;

      // Auto-detect injury types
      const iMatches = injuryTypes.filter((i) =>
        q.includes(String(i).toLowerCase())
      );
      if (iMatches.length) next.bodily_injury = iMatches;

      // Auto-detect vehicle types
      const vtMatches = vehicleTypes.filter((v) =>
        q.includes(String(v).toLowerCase())
      );
      if (vtMatches.length) next.vehicle_type = vtMatches;

      // Auto-detect contributing factors
      const fMatches = factors.filter((f) =>
        q.includes(String(f).toLowerCase())
      );
      if (fMatches.length) next.factor = fMatches;
    }

    setSelected(next);
    setAppliedSelected(next);
  };

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
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Top row: title + status */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.2 }}>
            NYC Collision Analytics
          </Typography>

          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              textAlign: { xs: "left", md: "right" },
            }}
          >
            Active filters: {activeFiltersCount}
            {loading ? " | Generating report…" : ""}
          </Typography>
        </Stack>

        {/* Second row: centered search + Generate Report */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ mt: 1.5, mb: 1.5 }}
        >
          <TextField
            size="small"
            placeholder='Search e.g. "Brooklyn 2022 pedestrian crashes"'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleGenerate();
              }
            }}
            sx={{
              width: { xs: "100%", sm: 420, md: 520 },
              bgcolor: "background.paper",
              borderRadius: 999,
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={loading}
            sx={{ borderRadius: 999, px: 3, mt: { xs: 1, md: 0 } }}
          >
            Generate Report
          </Button>
        </Stack>

        {/* Third row: dropdown filters */}
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
            onChange={(v) =>
              setSelected((s) => ({ ...s, vehicle_type: v }))
            }
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
            onChange={(v) =>
              setSelected((s) => ({ ...s, bodily_injury: v }))
            }
            options={injuryTypes}
          />
          <Tooltip title="Clear all filters">
            <span>
              <Button
                variant="outlined"
                onClick={resetFilters}
                disabled={loading}
              >
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
        <PlotCard
          title="Pie: bodily_injury share (Top 8)"
          data={figs.pie.data}
          layout={figs.pie.layout}
        />
      )}
    </Container>
  );
}