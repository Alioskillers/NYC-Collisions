import { useEffect, useRef, useState } from "react";
import { Grid, FormControl, InputLabel, Select, MenuItem, TextField } from "@mui/material";

const DEFAULT_STATE = {
  histCol: "", bins: 30,
  scatterX: "", scatterY: "", limit: 3000,
  boxCol: "", boxBy: "",
  barCat: "",
  lineDate: "",
  corrCols: "",
  pieCat: ""
};

const shallowEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export default function EDAControls({ meta, onChange, initial }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const readyRef = useRef(false);

  // load initial defaults from parent once
  useEffect(() => {
    if (!initial) return;
    setState(prev => {
      const next = { ...prev, ...initial };
      return shallowEqual(prev, next) ? prev : next;
    });
    readyRef.current = true;
  }, [initial]);

  // propagate changes upward
  useEffect(() => {
    if (!readyRef.current) return;
    if (onChange) onChange(state);
  }, [state, onChange]);

  const set = (k, v) => {
    setState(prev => {
      const next = { ...prev, [k]: v };
      return shallowEqual(prev, next) ? prev : next;
    });
  };

  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Histogram Column</InputLabel>
          <Select label="Histogram Column" value={state.histCol} onChange={e=>set("histCol", e.target.value)}>
            {meta.numeric.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6} md={1.5}>
        <TextField label="Bins" size="small" type="number" value={state.bins}
          onChange={e=>set("bins", Number(e.target.value)||30)} />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Scatter X</InputLabel>
          <Select label="Scatter X" value={state.scatterX} onChange={e=>set("scatterX", e.target.value)}>
            {meta.numeric.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Scatter Y</InputLabel>
          <Select label="Scatter Y" value={state.scatterY} onChange={e=>set("scatterY", e.target.value)}>
            {meta.numeric.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={6} md={1.5}>
        <TextField label="Limit" size="small" type="number" value={state.limit}
          onChange={e=>set("limit", Number(e.target.value)||3000)} />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Box Column</InputLabel>
          <Select label="Box Column" value={state.boxCol} onChange={e=>set("boxCol", e.target.value)}>
            {meta.numeric.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Box Group By</InputLabel>
          <Select label="Box Group By" value={state.boxBy} onChange={e=>set("boxBy", e.target.value)}>
            <MenuItem value="">(none)</MenuItem>
            {meta.categorical.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Bar Category</InputLabel>
          <Select label="Bar Category" value={state.barCat} onChange={e=>set("barCat", e.target.value)}>
            {meta.categorical.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Line Date Column</InputLabel>
          <Select label="Line Date Column" value={state.lineDate} onChange={e=>set("lineDate", e.target.value)}>
            {meta.datetime.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Correlation Cols (multi)</InputLabel>
          <Select
            multiple
            value={state.corrCols ? state.corrCols.split(",") : []}
            onChange={e=>set("corrCols", e.target.value.join(","))}
            renderValue={(sel) => (sel || []).join(", ")}
          >
            {meta.numeric.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Pie Category</InputLabel>
          <Select label="Pie Category" value={state.pieCat} onChange={e=>set("pieCat", e.target.value)}>
            {meta.categorical.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
}
