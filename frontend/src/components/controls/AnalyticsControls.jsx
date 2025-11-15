// frontend/src/components/controls/AnalyticsControls.jsx
import {
  Box,
  Paper,
  Grid,
  Divider,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Slider,
  Button,
  Typography,
  Autocomplete,
  Chip,
} from "@mui/material";

const NUMERIC_CRASH_COLS = [
  "hour",
  "latitude",
  "longitude",
  "number_of_persons_injured",
  "number_of_persons_killed",
  "number_of_pedestrians_injured",
  "number_of_pedestrians_killed",
  "number_of_cyclist_injured",
  "number_of_cyclist_killed",
  "number_of_motorist_injured",
  "number_of_motorist_killed",
];

const NUMERIC_PERSON_COLS = [
  "hour",
  "person_age",
];

const CATEGORICAL_FROM_CRASH = [
  "borough",
  "vehicle_type",   // mapped in backend from vehicle_type_code1..5
  "factor",         // contributing factor 1..2
];

const CATEGORICAL_FROM_PERSONS = [
  "person_type",
  "bodily_injury",
  "person_sex",
];

const SCATTER_CANDIDATES_CRASH = ["latitude", "longitude", "hour", "number_of_persons_injured"];
const SCATTER_CANDIDATES_PERSON = ["hour", "person_age"];

export default function AnalyticsControls({
  value,       // draft state
  onChange,    // setDraft(patch)
  onReset,     // reset both states
  onApply,     // set applied = draft (Generate Report)
}) {
  const {
    from, freq, top, limit, bins, search,
    line_date_col,
    bar_cat,
    pie_cat,
    scatter_x, scatter_y,
    box_col, box_by,
    corr_cols,
  } = value;

  const numericCols = from === "persons" ? NUMERIC_PERSON_COLS : NUMERIC_CRASH_COLS;
  const categoricalCols = from === "persons" ? CATEGORICAL_FROM_PERSONS : CATEGORICAL_FROM_CRASH;
  const scatterCols = from === "persons" ? SCATTER_CANDIDATES_PERSON : SCATTER_CANDIDATES_CRASH;

  const patch = (p) => onChange({ ...value, ...p });

  return (
    <Paper
      elevation={0}
      sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
    >
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Controls
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Adjust settings below, then click <b>Generate Report</b> to refresh all charts together.
          </Typography>
        </Grid>

        {/* Central Generate Button */}
        <Grid item xs={12} md={4} textAlign={{ xs: "left", md: "right" }}>
          <Button
            variant="contained"
            size="large"
            onClick={onApply}
            sx={{ fontWeight: 700 }}
          >
            Generate Report
          </Button>
        </Grid>

        {/* GLOBAL */}
        <Grid item xs={12} md={2.5}>
          <FormControl fullWidth size="small">
            <InputLabel id="from-lb">Dataset</InputLabel>
            <Select
              labelId="from-lb"
              label="Dataset"
              value={from}
              onChange={(e) => patch({ from: e.target.value })}
            >
              <MenuItem value="crashes">Crashes</MenuItem>
              <MenuItem value="persons">Persons</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="freq-lb">Line Freq</InputLabel>
            <Select
              labelId="freq-lb"
              label="Line Freq"
              value={freq}
              onChange={(e) => patch({ freq: e.target.value })}
            >
              <MenuItem value="M">Monthly</MenuItem>
              <MenuItem value="Y">Yearly</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6} md={2}>
          <TextField
            size="small"
            label="Bar/Pie Top-N"
            type="number"
            value={top}
            onChange={(e) => patch({ top: Math.max(1, Number(e.target.value || 1)) })}
          />
        </Grid>

        <Grid item xs={12} md={3}>
          <Typography variant="caption">Scatter Sample Limit: {limit}</Typography>
          <Slider
            value={limit}
            min={200}
            max={10000}
            step={200}
            onChange={(_, v) => patch({ limit: v })}
          />
        </Grid>

        <Grid item xs={12} md={2.5}>
          <Typography variant="caption">Histogram Bins: {bins}</Typography>
          <Slider
            value={bins}
            min={6}
            max={60}
            step={2}
            onChange={(_, v) => patch({ bins: v })}
          />
        </Grid>

        <Grid item xs={12} md={2.5}>
          <TextField
            fullWidth
            size="small"
            label="Search term"
            placeholder="optional"
            value={search}
            onChange={(e) => patch({ search: e.target.value })}
          />
        </Grid>

        <Grid item xs={12}>
          <Divider />
        </Grid>

        {/* LINE */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="line-date-lb">Line: Date Column</InputLabel>
            <Select
              labelId="line-date-lb"
              label="Line: Date Column"
              value={line_date_col}
              onChange={(e) => patch({ line_date_col: e.target.value })}
            >
              <MenuItem value="crash_date">crash_date</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {/* BAR */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="bar-cat-lb">Bar: Category</InputLabel>
            <Select
              labelId="bar-cat-lb"
              label="Bar: Category"
              value={bar_cat}
              onChange={(e) => patch({ bar_cat: e.target.value })}
            >
              {categoricalCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* PIE */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="pie-cat-lb">Pie: Category</InputLabel>
            <Select
              labelId="pie-cat-lb"
              label="Pie: Category"
              value={pie_cat}
              onChange={(e) => patch({ pie_cat: e.target.value })}
            >
              {categoricalCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* SCATTER */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="scatter-x-lb">Scatter: X</InputLabel>
            <Select
              labelId="scatter-x-lb"
              label="Scatter: X"
              value={scatter_x}
              onChange={(e) => patch({ scatter_x: e.target.value })}
            >
              {scatterCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="scatter-y-lb">Scatter: Y</InputLabel>
            <Select
              labelId="scatter-y-lb"
              label="Scatter: Y"
              value={scatter_y}
              onChange={(e) => patch({ scatter_y: e.target.value })}
            >
              {scatterCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* BOX */}
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="box-col-lb">Box: Value</InputLabel>
            <Select
              labelId="box-col-lb"
              label="Box: Value"
              value={box_col}
              onChange={(e) => patch({ box_col: e.target.value })}
            >
              {numericCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel id="box-by-lb">Box: Group By</InputLabel>
            <Select
              labelId="box-by-lb"
              label="Box: Group By"
              value={box_by}
              onChange={(e) => patch({ box_by: e.target.value })}
            >
              {categoricalCols.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* CORR */}
        <Grid item xs={12} md={6}>
          <Autocomplete
            multiple
            size="small"
            options={numericCols}
            value={corr_cols}
            onChange={(_, v) => patch({ corr_cols: v })}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Correlation: Columns" />}
          />
        </Grid>

        <Grid item xs={12} textAlign="right">
          <Button variant="outlined" onClick={onReset}>Reset</Button>
        </Grid>
      </Grid>
    </Paper>
  );
}