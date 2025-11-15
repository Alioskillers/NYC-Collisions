// frontend/src/hooks/useAnalyticsControls.js
import { useCallback, useMemo, useState } from "react";

const DEFAULTS = {
  // global
  from: "crashes",     // 'crashes' | 'persons'
  freq: "M",           // 'M' | 'Y' (for line)
  top: 8,              // bar/pie Top-N
  limit: 3000,         // scatter sampling cap
  bins: 24,            // histogram bins
  search: "",          // optional keyword

  // line
  line_date_col: "crash_date",

  // bar
  bar_cat: "bodily_injury",

  // pie
  pie_cat: "person_type",

  // scatter
  scatter_x: "latitude",
  scatter_y: "hour",

  // box
  box_col: "hour",
  box_by: "bodily_injury",

  // corr
  corr_cols: ["latitude", "hour", "number_of_persons_injured"],
};

function buildApi(state) {
  const params = (obj) => new URLSearchParams(obj).toString();

  // include search if provided (safe even if backend ignores it)
  const optSearch = state.search?.trim()
    ? { search: state.search.trim() }
    : {};

  const line = `/api/eda/line?${params({
    date_col: state.line_date_col,
    freq: state.freq,
    ...optSearch,
  })}`;

  const bar = `/api/eda/bar?${params({
    cat: state.bar_cat,
    top: String(state.top),
    ...optSearch,
  })}`;

  const pie = `/api/eda/pie?${params({
    cat: state.pie_cat,
    top: String(state.top),
    ...optSearch,
  })}`;

  const scatter = `/api/eda/scatter?${params({
    x: state.scatter_x,
    y: state.scatter_y,
    limit: String(state.limit),
    from: state.from,
    ...optSearch,
  })}`;

  const box = `/api/eda/box?${params({
    col: state.box_col,
    by: state.box_by,
    from: state.from,
    ...optSearch,
  })}`;

  const corr = `/api/eda/corr?${params({
    cols: state.corr_cols.join(","),
    ...optSearch,
  })}`;

  const hist = `/api/eda/hist?${params({
    col: "hour", // keep 'hour' for now (can be exposed later)
    bins: String(state.bins),
    from: state.from,
    ...optSearch,
  })}`;

  return { line, bar, pie, scatter, box, corr, hist };
}

export function useAnalyticsControls() {
  // draft: what the user is editing right now
  const [draft, setDraft] = useState(DEFAULTS);
  // applied: what charts actually use
  const [applied, setApplied] = useState(DEFAULTS);

  const reset = useCallback(() => {
    setDraft(DEFAULTS);
    setApplied(DEFAULTS);
  }, []);

  const apply = useCallback(() => {
    setApplied(draft);
  }, [draft]);

  const api = useMemo(() => buildApi(applied), [applied]);

  return {
    draft,
    setDraft,   // called by Controls while editing
    applied,
    apply,      // called by "Generate Report"
    reset,
    api,        // URLs built from APPLIED state
    DEFAULTS,
  };
}