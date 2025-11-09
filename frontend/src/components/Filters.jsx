import { useEffect, useMemo, useState } from "react";
import { Grid, FormControl, InputLabel, Select, MenuItem } from "@mui/material";

export default function Filters({ meta, onChange }) {
  const [filters, setFilters] = useState({});
  useEffect(() => { onChange(filters); }, [filters]);

  const years = useMemo(() => (meta?.years || []).sort((a,b)=>a-b), [meta]);
  const update = (key, value) => setFilters((f) => {
    const next = { ...f, [key]: value || undefined };
    Object.keys(next).forEach(k => (next[k] === "" || next[k] == null) && delete next[k]);
    return next;
  });

  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Borough</InputLabel>
          <Select label="Borough" value={filters.borough || ""} onChange={(e)=>update("borough", e.target.value)}>
            <MenuItem value="">All Boroughs</MenuItem>
            {meta.boroughs?.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Year</InputLabel>
          <Select label="Year" value={filters.year || ""} onChange={(e)=>update("year", e.target.value)}>
            <MenuItem value="">All Years</MenuItem>
            {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Vehicle Type</InputLabel>
          <Select label="Vehicle Type" value={filters.vehicle_type || ""} onChange={(e)=>update("vehicle_type", e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            {meta.vehicle_types?.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Factor</InputLabel>
          <Select label="Factor" value={filters.factor || ""} onChange={(e)=>update("factor", e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            {meta.contributing_factors?.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Injury Type</InputLabel>
          <Select label="Injury Type" value={filters.injury_type || ""} onChange={(e)=>update("injury_type", e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            {meta.injury_types?.map((it) => <MenuItem key={it} value={it}>{it}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
}