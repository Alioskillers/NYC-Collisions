// frontend/src/components/SearchBar.jsx
import React, { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  IconButton,
  InputAdornment,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

function normalize(str) {
  return String(str || "").toLowerCase();
}

/**
 * Very lightweight "NLP" parser:
 * - Detects boroughs by name
 * - Detects years (4-digit) that exist in `years`
 * - Detects vehicle / factor / injury labels if user types them or parts of them
 *
 * Returns an object shaped like `selectedDraft` / `selectedApplied`.
 */
function parseQuery(query, { boroughs, years, vehicleTypes, factors, injuryTypes }) {
  const q = normalize(query);
  const selected = {
    borough: [],
    year: [],
    vehicle_type: [],
    factor: [],
    bodily_injury: [],
  };

  if (!q.trim()) return selected;

  // Boroughs – match by name substring, case-insensitive
  boroughs.forEach((b) => {
    if (q.includes(normalize(b))) selected.borough.push(b);
  });

  // Years – any 4-digit year that’s also in our list
  const yearMatches = q.match(/(19|20)\d{2}/g) || [];
  yearMatches.forEach((yStr) => {
    if (years.includes(yStr) || years.includes(Number(yStr))) {
      if (!selected.year.includes(yStr)) selected.year.push(yStr);
    }
  });

  // Vehicle Type – match any word that appears inside the label
  vehicleTypes.forEach((vt) => {
    const vtNorm = normalize(vt);
    // Quick heuristic: if any word from query appears in vt label
    const words = q.split(/[^a-z0-9/]+/).filter(Boolean);
    if (words.some((w) => vtNorm.includes(w)) && !selected.vehicle_type.includes(vt)) {
      selected.vehicle_type.push(vt);
    }
  });

  // Contributing Factor
  factors.forEach((f) => {
    const fNorm = normalize(f);
    if (q.includes(fNorm) && !selected.factor.includes(f)) {
      selected.factor.push(f);
    }
  });

  // Bodily injury – match label or part of it (e.g. "head", "back")
  injuryTypes.forEach((inj) => {
    const injNorm = normalize(inj);
    if (q.includes(injNorm) && !selected.bodily_injury.includes(inj)) {
      selected.bodily_injury.push(inj);
    }
  });

  return selected;
}

export default function SearchBar({
  boroughs = [],
  years = [],
  vehicleTypes = [],
  factors = [],
  injuryTypes = [],
  onApply,
  disabled = false,
}) {
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseQuery(query, {
      boroughs,
      years,
      vehicleTypes,
      factors,
      injuryTypes,
    });

    if (onApply) onApply(parsed);

    const parts = [];
    if (parsed.borough.length) parts.push(`Borough: ${parsed.borough.join(", ")}`);
    if (parsed.year.length) parts.push(`Year: ${parsed.year.join(", ")}`);
    if (parsed.vehicle_type.length)
      parts.push(`Vehicle: ${parsed.vehicle_type.slice(0, 2).join(", ")}${parsed.vehicle_type.length > 2 ? "…" : ""}`);
    if (parsed.factor.length)
      parts.push(`Factor: ${parsed.factor.slice(0, 2).join(", ")}${parsed.factor.length > 2 ? "…" : ""}`);
    if (parsed.bodily_injury.length)
      parts.push(`Injury: ${parsed.bodily_injury.slice(0, 2).join(", ")}${parsed.bodily_injury.length > 2 ? "…" : ""}`);

    if (!parts.length) {
      setSummary("Applied – no specific filters detected (showing all data).");
    } else {
      setSummary(`Applied – ${parts.join(" • ")}`);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSummary("");
    if (onApply) {
      onApply({
        borough: [],
        year: [],
        vehicle_type: [],
        factor: [],
        bodily_injury: [],
      });
    }
  };

  return (
    <Paper
      elevation={1}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
      }}
    >
      <form onSubmit={handleSubmit}>
        <TextField
          size="small"
          fullWidth
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search filters, e.g.: "Brooklyn 2019 pedestrian"'
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {query && (
                  <Tooltip title="Clear search & filters">
                    <IconButton size="small" onClick={handleClear} edge="end">
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </InputAdornment>
            ),
          }}
        />
      </form>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {summary || 'Press Enter to apply. I’ll detect boroughs, years, and known labels from your text.'}
      </Typography>
    </Paper>
  );
}